use std::path::PathBuf;
use std::sync::Mutex;

struct InitialFile(Mutex<Option<String>>);

/// Structured IPC error payload: { code, message } instead of a plain string,
/// so the frontend can branch by code (e.g., fall back to a Rust command
/// only when the plugin-fs error really is an access problem).
#[derive(serde::Serialize, Clone)]
struct AppError {
    code: String,
    message: String,
}

impl AppError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        AppError { code: code.to_string(), message: message.into() }
    }
}

fn map_io_error(e: std::io::Error) -> AppError {
    let code = match e.kind() {
        std::io::ErrorKind::NotFound => "FS_NOT_FOUND",
        std::io::ErrorKind::PermissionDenied => "FS_ACCESS_DENIED",
        std::io::ErrorKind::InvalidData | std::io::ErrorKind::InvalidInput => "FS_INVALID_DATA",
        _ => "FS_IO_ERROR",
    };
    AppError::new(code, e.to_string())
}

fn validate_path(path: &str) -> Result<PathBuf, AppError> {
    let pb = PathBuf::from(path);
    if pb.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err(AppError::new("FS_PATH_TRAVERSAL", "Path traversal not allowed"));
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
async fn read_file_content(path: String) -> Result<String, AppError> {
    let pb = validate_path(&path)?;
    if !is_text_extension(&pb) {
        return Err(AppError::new("FS_UNSUPPORTED_EXTENSION", "Unsupported file type"));
    }
    tokio::fs::read_to_string(&pb).await.map_err(map_io_error)
}

#[tauri::command]
async fn write_file_content(path: String, content: String) -> Result<(), AppError> {
    let pb = validate_path(&path)?;
    tokio::fs::write(&pb, content).await.map_err(map_io_error)
}

#[tauri::command]
async fn write_file_binary(path: String, data: String) -> Result<(), AppError> {
    let pb = validate_path(&path)?;
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| AppError::new("FS_INVALID_BINARY", e.to_string()))?;
    tokio::fs::write(&pb, bytes).await.map_err(map_io_error)
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
        // Only one GravityMD process: a second launch (e.g., double-click on a
        // .md while the app is running) focuses the first window and forwards
        // the file argument to it as a `file-open` event.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            use tauri::{Emitter, Manager};
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
                if let Some(path) = args.iter().nth(1) {
                    let _ = window.emit("file-open", path.clone());
                }
            }
        }))
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