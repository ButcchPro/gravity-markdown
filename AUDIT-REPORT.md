# Аудит GravityMD — Результаты

**Дата:** 2026-07-11  
**Версия проекта:** 1.0.3  
**Аудитор:** Senior Software Architect (автоматизированный аудит)

---

## Часть I: Качество кода и технический долг

### Вектор 1: Архитектурная чистота

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`App.tsx`](src/App.tsx) | 189–621 (весь `App`) | **Монолитный компонент** — `App` содержит 432 строки логики: 9 `useState`, файловые операции, импорт/экспорт DOCX/XLSX, тему, зум, About-диалог, парсинг Markdown→DOCX. Нарушение SRP. | Выделить кастомные хуки: `useFileOperations()`, `useTheme()`, `useZoom()`, `useExport()`, `useImport()`. Компонент `AboutDialog` — отдельный файл. |
| **Warning** | [`App.tsx`](src/App.tsx) | 200–216, 265–279, 258–263 | **DRY-нарушение (TS)**: `handleOpenFile` (стр. 200) и `handleOpen` (стр. 265) выполняют одну и ту же последовательность — чтение файла → `setCurrentFile` → `setContent` → `setCurrentValue` → `setFileKey`. Функция `loadContent` (стр. 258) дублирует тот же паттерн, но без `toaster.add`. | Унифицировать через `loadContent` с опциональным параметром `showToast`. `handleOpenFile` и `handleOpen` должны делегировать в `loadContent`. |
| **Warning** | [`App.tsx`](src/App.tsx) | 281–298, 300–318 | **DRY-нарушение (TS)**: `handleSave` (стр. 281) и `handleSaveAs` (стр. 300) содержат идентичный fallback-паттерн `try { writeTextFile } catch { invoke('write_file_content') }` и одинаковые `toaster.add`. | Выделить утилиту `safeWriteTextFile(path, content)` с единым fallback. |
| **Warning** | [`App.tsx`](src/App.tsx) | 491–503 | **DRY-нарушение (TS)**: fallback для бинарной записи в `handleExportDocx` — `try { writeFile } catch { invoke('write_file_binary') }` — тот же паттерн, что и для текстовых файлов, но с base64-кодированием. | Выделить утилиту `safeWriteBinaryFile(path, data)`. |
| **Warning** | [`App.tsx`](src/App.tsx) | 208, 241, 273 | **DRY-нарушение (TS)**: извлечение имени файла `path.split(/[\\/]/).pop()` повторяется 3 раза. | Выделить утилиту `getFileName(path: string): string`. |
| **Info** | [`lib.rs`](src-tauri/src/lib.rs) | 12–26 | **DRY-нарушение (Rust)**: `read_file_content`, `write_file_content`, `write_file_binary` — общий паттерн: принять `String`-путь → выполнить `fs::*` → `.map_err(\|e\| e.to_string())`. Три функции с идентичной обработкой ошибок. | При росте числа команд — выделить макрос или helper-функцию `map_fs_err`. Пока терпимо из-за малого количества команд. |
| **Info** | [`lib.rs`](src-tauri/src/lib.rs) | 12, 17, 22 | **Типизация путей**: все команды принимают `path: String` вместо `std::path::PathBuf` или `&Path`. Tauri 2.x десериализует JSON-аргументы в `String`, поэтому прямое использование `PathBuf` невозможно без дополнительной конвертации, однако внутри функции стоит преобразовывать `String` → `PathBuf` для использования типизированных API. | Добавить `let path = PathBuf::from(path);` внутри команд для совместимости с `fs::canonicalize` и другими `Path`-API. |
| **Info** | [`lib.rs`](src-tauri/src/lib.rs) | 4 | **Состояние приложения**: `InitialFile(Mutex<Option<String>>)` — единственное управляемое состояние. `OpenFiles` и `WindowCounter` из плана аудита **отсутствуют** в текущей кодовой базе — мультиоконность не реализована на уровне Rust. | Если мультиоконность планируется — внедрить `OpenFiles` реестр с `DashMap` или `RwLock<HashMap>`, избегая `Mutex<HashMap>`. |

### Вектор 2: Современные стандарты — Rust 2021 и React 19

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`lib.rs`](src-tauri/src/lib.rs) | 8 | **`.lock().ok().and_then()`** — паттерн молчаливого игнорирования ошибки `Mutex::lock`. Если мьютекс отравлен (poisoned), ошибка проглатывается без логирования. | Заменить на `.lock().expect("InitialFile mutex poisoned")` — в Tauri-контексте паника при poisoned mutex оправдана, либо использовать `lock().map_err(\|e\| e.to_string())?` для возврата ошибки через IPC. |
| **Info** | [`lib.rs`](src-tauri/src/lib.rs) | 46 | **`cfg!(debug_assertions)` в runtime** — макрос `cfg!()` вычисляется в compile-time и возвращает `bool`, что корректно. Однако смешивание `cfg!()` с runtime-условием — стилистически менее предпочтительно, чем `#[cfg(debug_assertions)]` на уровне блока. | Текущая реализация функционально верна. Для единообразия можно вынести в `#[cfg(debug_assertions)]` отдельную функцию `setup_logging()`. |
| **Warning** | [`App.tsx`](src/App.tsx) | 177–180 | **Отсутствие cleanup в `useEffect`**: `editor.on('change', ...)` подписывается на событие, но при размонтировании `EditorWrapper` подписка не снимается. `editor.off('change', ...)` не вызывается. | Сохранить ссылку на callback и вызвать `editor.off('change', handler)` в cleanup-функции `useEffect`. |
| **Warning** | [`App.tsx`](src/App.tsx) | 178–179 | **`onSave` вызывается на каждое нажатие клавиши** без debounce: `editor.on('change', () => onSave(editor.getValue()))`. Каждый символ вызывает `setCurrentValue`, что триггерит ре-рендер `App`. | Добавить debounce (например, 300мс) через `setTimeout`/`clearTimeout` в cleanup или использовать `useDeferredValue` из React 19. |
| **Info** | [`App.tsx`](src/App.tsx) | 53 | **Сигнатура `onSave`**: `onSave: (content: string) => void` — нестрогая типизация, нет гарантии что `content` не `undefined`. | Добавить тип `onSave: (content: string) => void` в отдельный `interface EditorWrapperProps` для самодокументируемости. |
| **Info** | [`App.tsx`](src/App.tsx) | 18 | **`import * as XLSX from 'xlsx'`** — импорт всей библиотеки вместо tree-shakeable импорта. `xlsx` v0.18 не поддерживает tree-shaking, поэтому это не улучшит бандл, но стоит отметить для миграции на `xlsx-js-style` или `exceljs`. | При возможности мигрировать на библиотеку с ESM/tee-shaking поддержкой. |
| **Info** | [`App.tsx`](src/App.tsx) | 250–251 | **Отсутствие `useMemo`**: `gravityTheme` и `dirty` пересчитываются при каждом рендере. `dirty = currentValue !== content` — дешёвая операция, но `gravityTheme` — объектная логика. | Обернуть `gravityTheme` в `useMemo(() => theme === 'solarized-light' ? 'light' : theme, [theme])`. `dirty` можно оставить как есть (примитивное сравнение). |
| **Info** | [`App.tsx`](src/App.tsx) | 200 | **`useCallback` только для `handleOpenFile`**: остальные обработчики (`handleOpen`, `handleSave`, `handleSaveAs`, `toggleTheme`) создаются при каждом рендере. | Либо добавить `useCallback` для всех обработчиков, передаваемых как props/в зависимости, либо не использовать `useCallback` вовсе (в React 19 компилятор оптимизирует автоматически при использовании React Compiler). |

### Вектор 3: Производительность и асинхронность

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Critical** | [`lib.rs`](src-tauri/src/lib.rs) | 12–14 | **Синхронный I/O в Tauri-командах**: `fs::read_to_string(&path)` и `fs::write(&path, ...)` — блокируют поток Tauri при чтении/записи больших файлов. В Tauri 2.x команды без `async` выполняются на общем потоке. | Переписать команды как `async fn` с использованием `tokio::fs::read_to_string` / `tokio::fs::write`, либо обернуть через `tokio::task::spawn_blocking(\|\| fs::read_to_string(path)).await`. |
| **Warning** | [`lib.rs`](src-tauri/src/lib.rs) | 22–25 | **`write_file_binary` — полная буферизация в памяти**: `base64::Engine::decode` загружает весь файл в память как `Vec<u8>`, затем `fs::write` записывает целиком. Для файлов >100MB — риск OOM. | Для больших файлов — стриминговая запись через `tokio::io::BufWriter`. Для текущих размеров DOCX-экспорта (<10MB) — терпимо. |
| **Warning** | [`App.tsx`](src/App.tsx) | 178–179 | **`editor.on('change')` без debounce** — вызывает `setCurrentValue` на каждое нажатие клавиши → ре-рендер `App` на каждый символ. | См. Вектор 2: добавить debounce 300мс. |
| **Warning** | [`App.tsx`](src/App.tsx) | 191, `fileKey` | **Полный ремаунт `EditorWrapper`** при смене файла: `key={fileKey}` заставляет React уничтожить и пересоздать весь редактор (включая ProseMirror/CodeMirror). Это дорого — инициализация `useMarkdownEditor` тяжёлая. | Использовать метод `editor.setValue(newContent)` вместо пересоздания через `key`. Требует рефакторинг `EditorWrapper` для принятия обновляемого `initialContent` через `useEffect`. |
| **Warning** | [`App.tsx`](src/App.tsx) | 328–336 | **`mammoth.convertToHtml` в главном потоке**: конвертация DOCX→HTML выполняется синхронно относительно UI. Для больших DOCX-файлов — блокировка интерфейса. | Вынести в Web Worker или использовать `requestIdleCallback` для разбиения на чанки. |
| **Warning** | [`App.tsx`](src/App.tsx) | 352–353 | **`XLSX.read` в главном потоке**: парсинг XLSX выполняется в главном потоке. | Аналогично — Web Worker для больших файлов. |
| **Warning** | [`App.tsx`](src/App.tsx) | 409–478 | **`handleExportDocx` — синхронный парсинг**: `currentValue.split('\n')` с линейным проходом и регулярками — на документах >10K строк блокирует UI. | Вынести `parseInline` и цикл парсинга в Web Worker, возвращать готовый `Document` через `postMessage`. |
| **Info** | [`App.tsx`](src/App.tsx) | 496–501 | **Блокирующая base64-кодировка**: цикл `for (let ci = 0; ci < uint8.length; ci += chunkSize)` с `String.fromCharCode.apply` — для больших бинарников создаёт промежуточные строки. | Использовать `Uint8Array.toBase64()` (доступно в современных браузерах) или `btoa(String.fromCharCode(...uint8))` через chunked-подход с `Array.from`. |

### Вектор 4: Гигиена кода и технический долг

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`package.json`](package.json) | 39 | **`vite-plugin-commonjs` в `dependencies`**: не используется в [`vite.config.ts`](vite.config.ts) — плагин не подключён. Мёртвая зависимость. | Удалить из `dependencies`. |
| **Warning** | [`package.json`](package.json) | 31 | **`@types/markdown-it` в `dependencies`**: типы должны быть в `devDependencies`. В продакшн-бандле они не нужны. | Переместить в `devDependencies`. |
| **Warning** | [`package.json`](package.json) | 32 | **`buffer` в `dependencies`**: полифил Node.js `Buffer` для браузера. В контексте Tauri 2 + Vite 8 с `target: es2023` — вероятно, не нужен, так как `@tauri-apps/api` не использует `Buffer`. | Проверить использование `Buffer` в коде. Если отсутствует — удалить. |
| **Warning** | [`package.json`](package.json) | 45 | **`@types/html-to-docx` в `devDependencies`**: `html-to-docx` не используется в проекте (заменён на `docx`). Мёртвый тип. | Удалить из `devDependencies`. |
| **Warning** | [`tauri.conf.json`](src-tauri/tauri.conf.json) | 23 | **`"csp": null`**: Content Security Policy отключена полностью. Это позволяет выполнять любой JavaScript и загружать ресурсы с любых доменов — критическая уязвимость для десктоп-приложения. | Настроить CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;` — минимально необходимый набор. |
| **Warning** | [`App.tsx`](src/App.tsx) | 284–288, 306–309 | **Fallback без проверки типа ошибки**: `try { await writeTextFile(...) } catch { await invoke('write_file_content', ...) }` — любая ошибка `writeTextFile` (включая `PermissionDenied`, `NotFound`, `NetworkError`) вызывает Rust-fallback. Это маскирует реальные проблемы. | Проверять тип ошибки: fallback только для `PermissionDenied` или специфичных кодов. Для остальных — пробрасывать ошибку. |
| **Warning** | [`App.tsx`](src/App.tsx) | 491–503 | **Аналогичный fallback для бинарной записи**: `try { writeFile } catch { invoke('write_file_binary') }` — та же проблема. | Аналогично: проверять тип ошибки перед fallback. |
| **Info** | [`App.tsx`](src/App.tsx) | множественные | **`toaster.add` с повторяющейся структурой**: 10+ вызовов с `{ name: '...', title: '...', theme: '...' }`. Одинаковый паттерн, разные данные. | Выделить хелпер `notify(title, theme)` с автогенерацией `name` (или использовать `name: 'gravity-toast'` для авто-замены). |
| **Info** | [`lib.rs`](src-tauri/src/lib.rs) | 56 | **`expect("error while running tauri application")`** — паника при ошибке запуска без логирования контекста. | Допустимо для точки входа, но лучше заменить на `eprintln!` + `std::process::exit(1)` для контролируемого завершения. |
| **Info** | [`App.tsx`](src/App.tsx) | 1–27 | **27 импортов в одном файле**: признак монолитности. 7 из них — для `docx`-экспорта, 3 — для `mammoth`/`turndown`/`XLSX`. | При декомпозиции `App.tsx` импорты распределятся по соответствующим модулям. |
| **Info** | [`ErrorBoundary.tsx`](src/ErrorBoundary.tsx) | 29 | **Хардкод стилей в ErrorBoundary**: `style={{ padding: '20px', color: 'red', backgroundColor: '#fff', height: '100vh' }}` — не следует теме приложения. | Использовать CSS-класс или переменные темы. |
| **Info** | — | — | **TODO/FIXME/HACK**: не обнаружены в кодовой базе. | — |
| **Info** | [`capabilities/default.json`](src-tauri/capabilities/default.json) | 17–29 | **Широкие разрешения `fs`**: `allow-read-text-file`, `allow-write-text-file`, `allow-read-file`, `allow-write-file` с `{ "path": "**" }` — полный доступ к файловой системе без ограничений. | Ограничить scope путей (например, только документы пользователя), либо добавить валидацию путей в Rust-командах. |

---

## Часть II: Архитектурное единство

### Вектор 5: Семантическое дублирование алгоритмов

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`App.tsx`](src/App.tsx) | 202, 208, 241 | **Извлечение имени файла в TS**: `path.split(/[\\/]/).pop()` — используется 3 раза (стр. 202 в проверке расширения, стр. 208 в toaster, стр. 241 в заголовке окна). | Выделить утилиту `getFileName(path: string): string` в общий модуль `utils/path.ts`. |
| **Warning** | [`App.tsx`](src/App.tsx) | 202 | **Проверка расширений в TS**: `path.toLowerCase().endsWith('.md') \|\| path.toLowerCase().endsWith('.txt') \|\| path.toLowerCase().endsWith('.markdown')` — логика валидации расширений дублируется между `handleOpenFile` (стр. 202: `.md`, `.txt`, `.markdown`) и диалогом `open()` (стр. 269: `['md', 'txt']`). Набор расширений не совпадает: `.markdown` отсутствует в диалоге. | Унифицировать константу `SUPPORTED_EXTENSIONS = ['md', 'txt', 'markdown']` и использовать её в обоих местах. |
| **Info** | [`App.tsx`](src/App.tsx) | 202 | **Нормализация путей в TS**: `.split(/[\\/]/).pop()` — обрабатывает оба разделителя `/` и `\`. В Rust-бэкенде нормализация путей отсутствует (команды принимают путь как есть). | Если мультиоконность будет реализована — нужна единая стратегия нормализации (либо на бэкенде через `PathBuf::canonicalize`, либо через IPC-контракт с нормализованным путём). |
| **Info** | [`lib.rs`](src-tauri/src/lib.rs) | 12–26 | **Отсутствие валидации расширений в Rust**: команды `read_file_content` / `write_file_content` принимают любой путь без проверки расширения. Валидация — исключительно на фронтенде. | Добавить минимальную валидацию на бэкенде (defense-in-depth): проверять расширение или использовать `fs:allow-*` scope в capabilities. |

### Вектор 6: Единообразие IPC-контрактов (Frontend ↔ Backend)

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`App.tsx`](src/App.tsx) | 272 vs 203 | **Два канала для чтения файлов**: `handleOpen` использует `readTextFile` из `@tauri-apps/plugin-fs` (стр. 272), а `handleOpenFile` использует `invoke('read_file_content')` (стр. 203). Нет единой стратегии — когда какой канал использовать. | Формализовать в утилиту `safeReadTextFile(path)`: сначала `readTextFile`, при ошибке — `invoke('read_file_content')`. Аналогично для записи. |
| **Warning** | [`App.tsx`](src/App.tsx) | 284–288, 306–309 | **Два канала для записи файлов**: `handleSave` и `handleSaveAs` используют `writeTextFile` с fallback на `invoke('write_file_content')`. Fallback не различает тип ошибки. | См. Вектор 4: проверять тип ошибки перед fallback. |
| **Warning** | [`App.tsx`](src/App.tsx) | 242 | **Молчаливое проглатывание IPC-ошибок**: `getCurrentWindow().setTitle(...).catch(console.error)` — ошибка установки заголовка окна логируется в консоль, но пользователь не видит. | Для `setTitle` — допустимо (некритичная операция). Для критичных IPC-вызовов — добавить user-facing уведомление. |
| **Info** | [`App.tsx`](src/App.tsx) | 203, 226, 287, 502 | **Нейминг IPC-команд**: `read_file_content`, `write_file_content`, `write_file_binary`, `get_initial_file` — snake_case в Rust, camelCase в `invoke()` на TS-стороне (Tauri автоматически конвертирует). Единообразно. | — |
| **Info** | [`lib.rs`](src-tauri/src/lib.rs) | 7, 12, 17, 22 | **Сигнатуры команд**: `get_initial_file` → `Option<String>`, `read_file_content` → `Result<String, String>`, `write_file_content` → `Result<(), String>`, `write_file_binary` → `Result<(), String>`. Единообразно — все ошибки как `String`. | Для лучшей диагностики — перейти на структурированные ошибки (см. Вектор 8). |

### Вектор 7: Стандартизация сквозных задач

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`App.tsx`](src/App.tsx) | 194–195 | **Неединообразное управление состоянием**: тема — `plugin-store` (persistent, async), зум — `useState` (не сохраняется между сессиями), файл — `useState` + Rust-реестр (гибрид, но реестр не реализован). | Все persistent-настройки (тема, зум) — через `plugin-store`. Файловое состояние — через Rust-реестр при мультиоконности. |
| **Warning** | [`App.tsx`](src/App.tsx) | 202 vs 269 | **Несогласованная валидация расширений**: `handleOpenFile` (стр. 202) проверяет `.md`, `.txt`, `.markdown`; диалог `open()` (стр. 269) фильтрует `['md', 'txt']`. Расширение `.markdown` пропущено в диалоге. | Унифицировать через константу `SUPPORTED_EXTENSIONS`. |
| **Warning** | [`App.tsx`](src/App.tsx) | 328–336 | **Отсутствие валидации содержимого**: при импорте DOCX через `mammoth` результат не проверяется на пустоту или корректность. Пустой HTML → пустой Markdown → пользователь не получает обратной связи. | Проверять `result.value.trim().length === 0` и показывать предупреждение. |
| **Info** | [`lib.rs`](src-tauri/src/lib.rs) | 46–52 | **Логирование только в debug**: `tauri-plugin-log` инициализируется только при `cfg!(debug_assertions)`. В production — нет логирования. | Для production-диагностики — добавить логирование с уровнем `Error` или `Warn`, записывающее в файл. |
| **Info** | [`App.tsx`](src/App.tsx) | множественные | **Логирование в TS**: `console.error` / `console.warn` — неструктурированное. В Tauri-приложении консоль не видна пользователю. | Интегрировать `tauri-plugin-log` на фронтенде через `@tauri-apps/plugin-log` для единообразия с Rust-бэкендом. |
| **Info** | [`tauri.conf.json`](src-tauri/tauri.conf.json) | 13–19 | **Размеры окон**: главное окно 800×600. Мультиоконность не реализована, но при реализации — дочерние окна должны наследовать тему/зум. | При внедрении мультиоконности — передавать тему/зум через URL-параметры или shared state. |

### Вектор 8: Контракты передачи данных

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`App.tsx`](src/App.tsx) | 203, 226, 287, 502 | **Generic-типы IPC указываются вручную**: `invoke<string>('read_file_content', ...)`, `invoke<string \| null>('get_initial_file', ...)`. Нет централизованных типов для ответов команд. | Создать модуль `types/ipc.ts` с типизированными обёртками: `function readFilePath(path: string): Promise<string>` и т.д. |
| **Warning** | [`lib.rs`](src-tauri/src/lib.rs) | 12–26 | **Ошибки как plain string**: `Result<T, String>` — потеря контекста ошибки. TypeScript ловит `catch (e)` и выводит `console.error(e)` — нет структурированного error payload. | Определить `enum AppError` с кодами (`FileNotFound`, `PermissionDenied`, `InvalidPath`, `IoError`) и сериализовать в JSON: `Result<T, AppError>`, где `AppError` реализует `Serialize`. |
| **Warning** | [`App.tsx`](src/App.tsx) | 203, 287, 502 | **Параметры IPC как отдельные аргументы**: `{ path }`, `{ path, content }`, `{ path, data }` — нет centralised command objects. | Создать интерфейсы `IpcReadFileParams`, `IpcWriteFileParams`, `IpcWriteBinaryParams` в `types/ipc.ts`. |
| **Info** | [`App.tsx`](src/App.tsx) | 226 | **`invoke('get_initial_file')` без generic**: вызов без указания типа — TypeScript выводит `unknown`. | Указать `invoke<string | null>('get_initial_file')` (уже исправлено в коде — стр. 226). |

---

## Сводка

### Подсчёт находок

| Метрика | Значение |
|---------|----------|
| **Critical** | 2 |
| **Warning** | 23 |
| **Info** | 16 |
| **Всего** | 41 |

### Оценки

| Метрика | Оценка | Обоснование |
|---------|--------|-------------|
| **Code Cleanliness** | **5.2 / 10** | Монолитный `App.tsx` (432 строки), DRY-нарушения в файловых операциях, отсутствие cleanup в `useEffect`, синхронный I/O в Rust-командах, fallback без проверки типа ошибки. Сильные стороны: нет TODO/FIXME, строгий TypeScript (`noUnusedLocals`, `noUnusedParameters`), чистый Rust-код (малый объём, консистентная обработка ошибок). |
| **Architecture Unification** | **3.8 / 10** | Два параллельных канала файлового I/O без формализованной стратегии, дублирование валидации расширений, неединообразное управление состоянием (тема persistent, зум transient), ошибки IPC как plain string, отсутствие централизованных типов, CSP отключена. |
| **Aggregate** | **4.5 / 10** | Среднее взвешенное: Code Cleanliness × 0.5 + Architecture Unification × 0.5 = 2.6 + 1.9 = 4.5. Архитектурное единство — основное поле для улучшений. |

### Топ-5 приоритетных исправлений

1. **[Critical]** Включить CSP в [`tauri.conf.json`](src-tauri/tauri.conf.json:23) — безопасность десктоп-приложения под угрозой.
2. **[Critical]** Переписать Rust-команды на `async fn` с `tokio::fs` в [`lib.rs`](src-tauri/src/lib.rs:12-26) — блокировка потока Tauri при I/O.
3. **[Warning]** Добавить cleanup в `useEffect` `EditorWrapper` и debounce для `editor.on('change')` в [`App.tsx`](src/App.tsx:177-180) — утечка подписок и лишние ре-рендеры.
4. **[Warning]** Удалить мёртвые зависимости (`vite-plugin-commonjs`, `@types/html-to-docx`) и переместить `@types/markdown-it` в `devDependencies` в [`package.json`](package.json).
5. **[Warning]** Формализовать стратегию файлового I/O: утилиты `safeReadTextFile` / `safeWriteTextFile` с проверкой типа ошибки перед fallback в [`App.tsx`](src/App.tsx).