use std::path::PathBuf;
use std::sync::Mutex;

struct InitialFile(Mutex<Option<String>>);

fn validate_path(path: &str) -> Result<PathBuf, String> {
    let pb = PathBuf::from(path);
    if pb.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Path traversal not allowed".to_string());
    }
    Ok(pb)
}

fn is_text_extension(path: &PathBuf) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext.to_lowercase().as_str(), "md" | "txt" | "markdown"))
        .unwrap_or(false)
}

#[tauri::command]
fn get_initial_file(state: tauri::State<InitialFile>) -> Option<String> {
    state.0.lock().expect("InitialFile mutex poisoned").take()
}

#[tauri::command]
async fn read_file_content(path: String) -> Result<String, String> {
    let pb = validate_path(&path)?;
    if !is_text_extension(&pb) {
        return Err("Unsupported file type".to_string());
    }
    tokio::fs::read_to_string(&pb).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_file_content(path: String, content: String) -> Result<(), String> {
    let pb = validate_path(&path)?;
    tokio::fs::write(&pb, content).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_file_binary(path: String, data: String) -> Result<(), String> {
    let pb = validate_path(&path)?;
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(&data).map_err(|e| e.to_string())?;
    tokio::fs::write(&pb, bytes).await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let initial_file = if args.len() > 1 {
        Some(args[1].clone())
    } else {
        None
    };

    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Info
    } else {
        log::LevelFilter::Warn
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .manage(InitialFile(Mutex::new(initial_file)))
        .invoke_handler(tauri::generate_handler![get_initial_file, read_file_content, write_file_content, write_file_binary])
        .setup(move |app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log_level)
                    .build(),
            )?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}