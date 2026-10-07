# Аудит GravityMD — Результаты (октябрь 2026)

**Дата:** 2026-10-07
**Версия проекта:** 1.0.4
**Аудитор:** Senior Software Architect (автоматизированный аудит по [audit.md](audit.md))
**Охват:** текущая кодовая база, включая изменения Phase 25–27 (обновления Gravity UI 15.48.2, npm-sweep, YFM-конвертер, DOCX-грид).

---

## Часть I: Качество кода и технический долг

### Вектор 1: Архитектурная чистота

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Critical** | [`src/utils/yfmTable.ts`](src/utils/yfmTable.ts) | `findYfmBlocks` (ок. 149–167) | **Поиск YFM-блоков не учитывает code-fence**: `#|` / `\|#` внутри «` ``` «` оградок (документация о YFM-синтаксисе — легитимный случай) конвертируется как настоящая таблица и перезаписывается при сохранении. Тихая порча пользовательского контента на Save. | Вести плюс/минус состояние « ``` «`/`~~~`-fence при сканировании строк: блоки, открытые до `#|`, пропускать (не конвертировать, но и не считать kept-предупреждением). Аналогично пропуску indented-code. |
| **Warning** | [`src/App.tsx`](src/App.tsx) | 44–53 (init `useEffect`) | **Инициализация без обработки отказа**: `getVersion()` / `invokeGetInitialFile()` без try/catch; exception до `setReady(true)` даёт вечный `null`-рендер (белый экран) без любой диагностики для пользователя. | Обернуть async-блок в try/catch + `ErrorBoundary`-совместимый фолбэк: при ошибке `setReady(true)` с тостом/ошибкой. |
| **Warning** | [`src/components/EditorWrapper.tsx`](src/components/EditorWrapper.tsx) | 174–190 (`getSanitizedMarkup`) | **Геттер с побочными эффектами**: метод по имени «get» мутирует редактор (`editor.replace`) и показывает тост. Неявный контракт — вызов только в save-путях не документирован за пределами `useFileOperations`. | Переименовать в выполняющий семантику глагол (`commitSanitizedMarkup`), а чистый `sanitize()` оставить отдельной функцией; тост вынести наружу (в `useFileOperations` по возвращённому `kept`). |
| **Warning** | [`src/hooks/useExport.ts`](src/hooks/useExport.ts) | 350–368 (blockquote) | **Спред экземпляра класса docx**: `new Paragraph({ ...innerChild, indent…, border… })` — `innerChild` это уже готовый `Paragraph` (класс, не options-объект). Спред клонирует недокументированные внутренние поля, а не опции; свойства (children/spacing от ветки recursion) могут потеряться — поведение не гарантировано документацией docx API. | Пересобирать опции явно: рекурсия возвращает opсии (фабрика `ParagraphOptions`), а не готовые Paragraph; либо дублировать создание c indent/border поверх изначальных опций. |
| **Warning** | [`src/hooks/useExport.ts`](src/hooks/useExport.ts) | 316–326 (ul-ветка) | **Вложенные списки схлопываются**: при `hasBlocks` содержимое `<li>` выгружается единым bullets-параграфом; вложенные `ul/ol` не выгружаются отдельно и теряется структура уровней (текст вложенного пункта вставка-в-текст родителя). | Рекурсивный депозит: вложенные ul/ol разрешать с `level: 1` (docx поддерживает уровни), или хотя бы отдельно выгружать подпункты с отступом. |
| **Info** | [`src/components/EditorWrapper.tsx`](src/components/EditorWrapper.tsx) | 40–107 | Кастомный turndown-конверсор таблиц (45 строк) и 2 `overrideNodeSpec` — всё инлайн внутри `useMarkdownEditor` конфигурации компонента. Редакторе-домен, но не UI. | Вынести конверсию таблиц в модуль `src/editor/tablePaste.ts` (возврат готового Extension/Plugin) — компонент станет ~120 строк чистой сборки. |
| **Info** | [`src/utils/yfmTable.ts`](src/utils/yfmTable.ts) | весь файл | Вспомогательные функции (`parseYfmTableBody`, `containsLossyMarkup`, `findYfmBlocks`) не экспортируются — unit-тесты в проекте отсутствуют и сейчас невозможны без конвертации полной строки. Парсер — критичная к регрессии логика (пишет на диск). | Экспортировать внутренности + прогонять через `node --experimental-strip-types` (как делалось в Phase 27) либо vitest. |
| **Info** | [`src/App.tsx`](src/App.tsx) | 86 | `eslint-disable react-hooks/exhaustive-deps` — единственный в кодовой базе, с обосованием в комментарии. Терпимо. | Оставить. При апгрейде React-лето — переписать через stable-callback. |
| **Info** | [`src/hooks/useFileOperations.ts`](src/hooks/useFileOperations.ts) | 8–13, 65–80 | `getValue` — неявный контракт «вызывать только в save»; тип не защищает от вызова в read-контекста с побочным `editor.replace`. | Договор: пометить в реaли название `getForSave`/сэт комментария; side-эффекты сервера переkyedaю туда (см. Вектор 1). |

### Вектор 2: Современные стандарты — Rust 2021 и React 19

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`src/components/Toolbar.tsx`](src/components/Toolbar.tsx) | 89–91 | Иконка темы: solarized-режим показывает ту же `Sun`, что и dark (экспрессия `theme === 'dark' ? Sun : theme === 'light' ? Moon : Sun`) — состояние полутоновое, а иконок всего две. Безопасно, но недокументирована. | Третья иконка (`Moon`/`MoonHalf`/`Palette`) или `title`-подсказка на «Solarized». |
| **Info** | [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) | 58–62 | С `cfg!(debug_assertions)` — compiles-time вычисление в runtime, формально верно. | Уже документировано предаудитом: можно вынести в `#[cfg]`-блок. |
| **Info** | [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) | 22–24 | `lock().expect("InitialFile mutex poisoned")` — паника при poisoned applyнTD, стандарт тauri-контекста (улучшение Sept warnings подтверждено). | Оставить. |
| **Info** | [`src/App.tsx`](src/App.tsx) | 118 | Спред custom CSS-переменной через `as React.CSSProperties` — типизированный трюк вместо `React.CSSProperties & Record<--editor-zoom-scale, number>`. | Кастомный интерфейс `CSSVars` уменьшит `as`-касты. |
| **Info** | [`src/hooks/useTheme.ts`](src/hooks/useTheme.ts) | 33–38 / [`src/hooks/useZoom.ts`](src/hooks/useZoom.ts) | 30–35 | Два钩а повторяют Store-цепочку «load → commit on change» с одинаковым болtparamы каспинации. | Общий хук `usePersistedStore(key, default)` сократит 2×30 строк с тем же семантикой. |

### Вектор 3: Производительность и асинхронность

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`src/hooks/useImport.ts`](src/hooks/useImport.ts) | 12–45, 47–76 | `mammoth.convertToHtml` и `XLSX.read` на главном потоке — большие DOCX/XLSX морозят UI (п trappe аuditа не реализована). | Вынести в Web Worker (Vite `?worker`), диалог загрузки на время конверсии. |
| **Warning** | [`src/hooks/useExport.ts`](src/hooks/useExport.ts) | 466–495 (`handleExportDocx`) | Пресинхронный линейный проход при конверсии DOCX (markdown-it → DOMParser → docx-объекты) на больших файлах (>10k строк) вешает UI на секунды. | Split на сегменты через `requestIdleCallback` или Web Worker + сообщение `Document` обратно (docx-объекты следят DOM-free? — только data). |
| **Info** | [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) | 27–33 | Чтение файла как UTF-8 целиком (`tokio::fs::read_to_string`) — ок для .md; бинарный валидатор maîtrisé (dispatch с `is_text_extension`). | Для гигантских файлов — streaming не нужен против валидации размера (say, cap 16МБ). |
| **Info** | [`src/utils/ipc.ts`](src/utils/ipc.ts) | 34–49 | `safeWriteBinaryFile` чанки по 8192 через `String.fromCharCode.apply` — стэк устойчив при 8K (лимит хорошо выше), производительность O(n). | Замена на `btoa(unescape(encodeURIComponent(...)))` не пользуётся. Оставить как есть. |

### Вектор 4: Гигиена кода и технический долг

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`src-tauri/Cargo.toml`](src-tauri/Cargo.toml) | 4–7 | Метафайл из scaffold не заполнен: `description = "A Tauri App"`, `authors = ["you"]`, `license = ""`, `repository = ""` — видимо в Releases/пакете. | Заполнить реальными метаданными (MIT, Autoreskushev/opensky, URL репозиторииров). |
| **Warning** | корень репозитории | — | В корне лежат отладочные artifacts: `test-md2docx.mjs`, `test-mammoth.mjs`, `test-xlsx.mjs`, `test-html-to-docx.mjs`, `test.docx`, `test2.docx` — временные эксперименты Pipeline. Попадут в релизный тар. | Перенести в `scripts/experiments/` или удалить (логика уже задокументирована в history.md Phases 5/7/21). |
| **Warning** | [`src/App.tsx`](src/App.tsx) | (архитектура окон) | **Отсутствует `tauri-plugin-single-instance`**: двойной клик по .md при запущенном приложении создаёт второй процесс полностью с отдельным состоянием. Оба процесса при закрытии пишут `tauri-plugin-window-state` файл — последнreligion выигрывает, состояние позиции окна перезаписывается. | Добавить `tauri-plugin-single-instance` (Rust): второй запуск форwardит путь в первый процесс (или хотя бы исключить гонку window-state). |
| **Info** | [`README.md`](README.md) | 143 | Ссылка на LICENSE — абсолютная `file:///D:/AI%20Agent/…` — на GitHub безработица. | Markdown-ссылка `[LICENSE](LICENSE)`. |
| **Info** | [`src/tools/utils`](src/utils/notify.ts) | 1–7 | `new Toaster()` (module singleton) + provider-двойная инстанция (ToasterProvider toaster + ToasterComponent) — единственная официально поддержанная схема uikit, не smell. | — |
| **Info** | [`src/styles.scss`](src/styles.scss) | 13–18 | `.error-boundary` theme-aware (вариабели с fallback #fff/red) — old finding closed. | — |
| **Info** | [`tauri.conf.json`](src-tauri/tauri.conf.json) | 22–24 | CSP восстановлен ('<i>strict</i>' перечень c `unsafe-inline` only в styles) — old Critical closed. | Следить, чтобы новые пакеты не добавлялись без проверки `data:` и т.д. |
| **Info** | [`src/utils/ipc.ts`](src/utils/ipc.ts) | 4–10 | `isPermissionError` дискриминирует ошибку по подстрокам (`permission`/`eacces`/`access`) — хрупко; редакторы могут поменять формулировки, fallback ломаетсяharga маскирует ошибку (любой `access…`-текст → retry). Anchor: проверить err instanceof Tauri у plugin-fs code (`code === 'EPERM'`-подобные поля). | Discriminated switch по конкретным error-codes, else — throw через без fallback. |

---

## Часть II: Архитектурное единство

### Вектор 5: Семантическое дублирование алгоритмов

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`src/hooks/useImport.ts`](src/hooks/useImport.ts) :61–65 · [`src/components/EditorWrapper.tsx`](src/components/EditorWrapper.tsx) :43–82 · [`src/utils/yfmTable.ts`](src/utils/yfmTable.ts) :169–172 | — | **Три независимых сериализатора PIPE-таблиц** (XLSX-импорт, turndown-paste-rule, YFM-конвертер) с разным поведением: экранирование `\|`, паддинг коротких строк, collapsemulti-line, выравнивание колонок. Разные таблицы из одинаковых данных выглядят и парсятся по-разному. | Один `rowsToPipeTable(header, rows, opts?)` в `src/utils/pipeTable.ts`, все три пата вызывают его. |
| **Info** | [`src/utils/path.ts`](src/utils/path.ts) :1,7–10 · [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) :14–19 | — | Extension whitelist теперь зеркально md/txt/markdown в TS и Rust (audit-old расхождение закрыто). Rust-lookup case-insensitive, TS — `.toLowerCase().endsWith`. | Оставить; optional: `path.extension()` у Rust только полным lowercase — уже так. |
| **Info** | [`src/hooks/useFileOperations.ts`](src/hooks/useFileOperations.ts) :65–101 | — | `handleSave`/`handleSaveAs` — совместный префикс (write + set snapshot + toast) ~8 строк на каждый; DRY borderline: одна ветка уже имеет `safeWriteTextFile`. | Extract `persist(path, value)` helper при следующем добавлени behavior (не срочно). |

### Вектор 6: Единообразие IPC-контрактов (Frontend↔Backend)

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) :36–47 | `write_file_content`/`write_file_binary` | **Rust-команды пишут в любой путь без ограничения расширения/размера**, в то время как read ограничен белым списком. Компромисс `path: "**"` в capabilities делает renderer'bездонным: компромисс обрабативается для кириллицы, но не валидирует цель. | Минимум: cap-лимит размера (например 32МБ для binary), опционально — расширение whitelist для write (docx-экспорт + md/txt/markdown), или framework-level intent-token. |
| **Info** | [`src/types/ipc.ts`](src/types/ipc.ts) :17–31 | все вызовы | Invoke-generic-типы по-прежнему вручную на каждом вызове; централизованного командного интерфейса нет. Локально терпимо (4 команды). | При росте команд — генерировать типы из Rust (`ts-rs`/specta) или собрать `CommandMap`. |
| **Info** | [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) :27–47 | все команды | Ошибки IPC по-прежнему `Result<_, String>` — plain text, без кодов/деталей. TS ищет подстроки (см. Вектор 2/4). | Структурированный payload `{code, message}` — это экономит isPermissionError-хрупкость. |

### Вектор 7: Стандартизация сквозных задач

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Warning** | [`history.md`](history.md) (Phase 16) vs [`src/hooks/useZoom.ts`](src/hooks/useZoom.ts) | 6–41 | **Documentation drift**: журнал описывает зум как «no persistence, per user request» (reset to 100% при старте), но `useZoom` давно сохраняет `zoom` в plugin-store. Будущие агенты будут восстанавливать неверное поведение по журналу. | Обновить соответствующий пункт Phase 16 или добавить пометку «行为 изменен — см. Phase 2x». |
| **Info** | [`src/hooks/useTheme.ts`](src/hooks/useTheme.ts) :6–17 · [`src/hooks/useZoom.ts`](src/hooks/useZoom.ts) | 6–14 | Persistent-настройки (theme, zoom) через plugin-store — единый механизм соблюден (audit-old несостинность «zoom не через store» закрыта). | Оставить. |
| **Info** | [`src/utils/notify.ts`](src/utils/notify.ts) + console.* | — | Логирование: Rust — `tauri-plugin-log` (debug Info/release Warn), TS — только `console.error/warn`. Единый структурированный логгер отсутствует; user-driven logs в release почти не видны. | При росте функциональности — объединить в `tauri-plugin-log` (JS-стороне есть биндинг `tauri-plugin-log-api`). |
| **Info** | [`src/hooks/useImport.ts`](src/hooks/useImport.ts) :26–38 | DOCX-import | Содержимое файла не валидируется: binary с `.md` расширением прочитается как текст (garbage) — `read_file_content` контролирует только расширение. Предпроверка `Buffer.isEncoding`/size guard. | Дёшево: max size + utf8-strict check в Rust-команды (возвращает error code вместо garbage). |

### Вектор 8: Контракты передачи данных

| Серьёзность | Файл | Строка / Функция | Описание | Рекомендация |
|-------------|------|-------------------|----------|--------------|
| **Info** | [`src/utils/yfmTable.ts`](src/utils/yfmTable.ts) :175+ (`sanitizeYfmTables`) | — | Возвращаемый контракт `{value, converted, kept}` — ужеdTOD. Но тост-форматирование внутри EditorWrapper овыязывает утилиту отображаемых текстов. | Word-формулировки оставить caller'у (см. Вектор 1 finding по геттеру). |
| **Info** | [`src/App.tsx`](src/App.tsx) :38 | `getValue` | `?:`-fallback на `currentValue` перед mount — почти не используется (App не готово до ready), но маскирует «значение неизвестно» значением-заглушкой. | Вернуть `undefined` ранний (`throw`/guard в useFileOperations). Низкоприоритетно. |
| **Info** | [`src/hooks/useExport.ts`](src/hooks/useExport.ts) :477–480 | dynamic `import('@diplodoc/transform/lib/plugins/table')` | Subpath-import без `exports`-map в package.json — работает при bundler-resolution, но хрупко к суровым обновлениям (может исчезнуть). | Добавить `@ts-expect-error`-толику? Не нужно; просто держите в чек-листе обновлений (AGENTS rule №9). |

---

## Сводка

| Метрика | Оценка |
|---------|--------|
| Code Cleanliness | 8.7 |
| Architecture Unification | 8.4 |
| **Aggregate** | **8.6** |
| Critical | 1 |
| Warning | 10 |
| Info | 18 |

### Главные пункты следующего спринта
1. **Critical**: завершить fence-трекинг в `yfmTable.ts` — защита от порчи код-блоков при сохранении.
2. **Warning-pack**: single-instance plugin; fill Cargo.toml метды; чистка корня от test-файлов; Web Worker для импорта/экспорта (следующий по ценности step).
3. **Warning-pack**: единый `rowsToPipeTable` сериализатор — убирает три реализации pipe-таблиц.

### Прогресс относительно аудита июля (AUDIT-REPORT.md)
- Закрыто: монолит `App.tsx` (hooks-декомпозиция), CSP, safe-IO утилиты, debounce/cleanup подписок, единые `SUPPORTED_EXTENSIONS`, extension whitelist в Rust.
- Осталось из старого отчёта: Web Worker для тяжелых конверсий, структура IPC-ошибок, base64-буферизация (по размеру не критично).
- Новое с Phase 25–27: 1 Critical (fence-сканирование), дублирование PIPE-сериализаторов, documentation drift по zoom.
