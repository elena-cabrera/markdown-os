# Feature Plan: Electron Desktop App

## Goal

Ship a native desktop app for **macOS** and **Windows** that lets a non-technical user download Markdown-OS from the landing page, open it like a normal app, choose a markdown file or folder from a native picker modal, and use the existing editor without touching a terminal.

When the user closes the app, the embedded backend process must shut down cleanly.

The desktop app must:

-   start on a native picker screen every launch
-   show recent files and folders
-   open either a markdown file or a folder workspace
-   allow empty folders and offer **Create first note**
-   preserve the existing in-app multi-tab behavior
-   work offline, including vendored frontend assets and themes
-   expose downloadable installers from the landing page, with OS-aware default download buttons
-   expose a downloads page that lists the latest release first and older versions when available
-   support file associations for `.md` and `.markdown`
-   show a dismissible in-app update banner when a newer version is available

---

## Product Decisions

### Supported platforms

-   **macOS**
-   **Windows**

Linux is out of scope for this feature.

### Launch behavior

Every launch opens a picker-first desktop shell with:

-   recent files
-   recent folders
-   **Open file**
-   **Open folder**

The app does **not** auto-open the previously used workspace on startup. Users always land on the picker first.

### Workspace behavior

-   Single app window for v1
-   Existing file tabs remain unchanged inside the editor
-   Empty folders are allowed
-   Empty folders show a **Create first note** action

### Distribution behavior

-   Installers are distributed through **GitHub Releases**
-   The landing page detects the visitor OS and shows a default download button for that OS
-   A downloads subpage shows the latest version first and older versions below

### Update behavior

The app checks GitHub Releases for a newer version and, when found, shows a dismissible banner in the sidebar footer with:

-   latest version number
-   **Download update**
-   **Dismiss**

For v1, the update flow is download-only. In-app self-installing updates are out of scope.

---

## Current Constraints in the Repository

### Current CLI startup flow

The existing CLI validates a concrete input path up front, decides between `file` and `folder` mode, opens a browser, and then blocks in `uvicorn.run(...)`.

That is the correct flow for terminal usage, but not for an Electron app that must start before the user selects a file or folder.

Implications:

-   startup logic must be extracted from the current CLI path
-   browser auto-open must be skipped for Electron mode
-   backend startup must support an initial **empty desktop state**

### Current folder validation behavior

The current CLI rejects directories that do not already contain markdown files.

For desktop mode this must be relaxed, because the product requirement is to allow empty folders and offer **Create first note**.

### Current frontend asset behavior

The current editor HTML loads multiple dependencies from public CDNs:

-   KaTeX
-   Marked
-   Turndown
-   Turndown GFM plugin
-   Mermaid
-   svg-pan-zoom
-   highlight.js
-   html2pdf

This must be replaced with vendored local assets so the desktop app works fully offline.

---

## Architecture

### High-level approach

Keep the existing Python FastAPI backend and static frontend as the editor runtime, and wrap them in a native Electron shell.

#### Runtime model

1.  Electron starts
2.  Electron launches a bundled Python backend process on `127.0.0.1`
3.  Backend starts in **empty desktop mode**
4.  Electron loads the editor shell in a `BrowserWindow`
5.  Picker modal is shown immediately
6.  User selects a file or folder through a native Electron dialog
7.  Electron sends the selection to the backend via HTTP or IPC-backed HTTP calls
8.  Backend initializes file or folder mode dynamically
9.  Existing editor UI loads the selected workspace
10. On app close, Electron shuts the backend down cleanly

### Why this approach

-   Reuses the existing server routes, file handlers, websocket sync, and editor UI
-   Avoids rewriting the editor in a different renderer stack
-   Keeps desktop-specific concerns isolated to shell, picker UX, packaging, recents, and update checks
-   Preserves the current browser-based architecture while removing terminal/browser friction for end users

---

## Desktop Backend Spec

### New Python entrypoint

Add a desktop-specific backend module:

```text
markdown_os/desktop_runtime.py
```

Responsibilities:

-   launch the FastAPI server without opening a browser
-   bind only to `127.0.0.1`
-   start in a desktop-aware empty state
-   print or otherwise expose a readiness signal and chosen port for Electron
-   handle graceful shutdown

### Startup refactor

Extract reusable logic from `markdown_os/cli.py` into helper functions.

Recommended structure:

```text
markdown_os/app_runtime.py
```

Suggested public functions:

-   `resolve_target_path(path: Path, allow_empty_folder: bool = False) -> tuple[Path, str]`
-   `build_handler_for_target(path: Path, mode: str) -> FileHandler | DirectoryHandler`
-   `build_application(handler: FileHandler | DirectoryHandler | None, mode: str, desktop: bool = False) -> FastAPI`
-   `find_available_port(host: str = "127.0.0.1", start_port: int = 8000) -> int`

CLI behavior remains unchanged by default.

Desktop mode uses the same path validation rules, with one extension:

-   `allow_empty_folder=True`

### New desktop state model

Extend the server to support:

-   `mode = "empty"`
-   `handler = None`
-   `current_file = None`

In this state:

-   `/` still serves the app shell
-   desktop overlay is shown
-   editing routes that require a loaded workspace return a clear error or desktop-specific empty-state payload

### New desktop routes

Add desktop-only routes in `markdown_os/server.py` when the app is created with `desktop=True`.

#### `GET /api/health`

Returns:

```json
{ "ok": true, "mode": "empty" | "file" | "folder", "desktop": true }
```

Used by Electron for readiness and health checks.

#### `GET /api/desktop/state`

Returns:

```json
{
  "mode": "empty" | "file" | "folder",
  "currentPath": "/absolute/path/or/null",
  "isEmptyFolder": false
}
```

#### `POST /api/desktop/open-file`

Body:

```json
{ "path": "/absolute/path/to/file.md" }
```

Behavior:

-   validate file path with existing markdown file rules
-   instantiate `FileHandler`
-   switch app state to `mode = "file"`
-   return success payload

Response:

```json
{ "ok": true, "mode": "file", "path": "/absolute/path/to/file.md" }
```

#### `POST /api/desktop/open-folder`

Body:

```json
{ "path": "/absolute/path/to/folder" }
```

Behavior:

-   validate folder exists
-   allow empty folder
-   instantiate `DirectoryHandler`
-   switch app state to `mode = "folder"`
-   detect whether the folder contains markdown files

Response:

```json
{
  "ok": true,
  "mode": "folder",
  "path": "/absolute/path/to/folder",
  "isEmptyFolder": true
}
```

#### `POST /api/desktop/create-first-note`

Body:

```json
{
  "directory": "/absolute/path/to/folder",
  "filename": "Untitled.md"
}
```

Behavior:

-   verify current desktop session is folder mode
-   create a new markdown file in the target directory
-   open it in the existing editor workflow

Response:

```json
{
  "ok": true,
  "path": "Untitled.md"
}
```

#### `POST /api/desktop/close-workspace`

Behavior:

-   close active file/folder state
-   stop watchers for current handler
-   clear `current_file`
-   return to `mode = "empty"`

### Empty-folder behavior

Current folder validation rejects folders without markdown files. Desktop mode changes that behavior only for the desktop routes.

Implementation rule:

-   CLI `markdown-os open <folder>` stays strict
-   Electron folder selection accepts empty folders

### Shutdown behavior

Electron must request a graceful backend exit.

Preferred order:

1.  send shutdown signal to backend process
2.  wait briefly for normal exit
3.  only force-kill if graceful shutdown fails

This preserves current FastAPI lifespan cleanup:

-   stop file watcher observer
-   join observer thread
-   call `handler.cleanup()`

---

## Electron App Spec

### New desktop project layout

Add:

```text
desktop/
  package.json
  tsconfig.json
  electron-builder.yml
  src/
    main.ts
    preload.ts
    updater.ts
    recents.ts
    backend.ts
    dialogs.ts
```

### Main process responsibilities

`desktop/src/main.ts`

-   enforce single-instance lock
-   create one `BrowserWindow`
-   spawn bundled Python runtime/backend
-   wait for backend readiness using `/api/health`
-   load backend URL in the window
-   register native menu items
-   register file association handlers
-   handle deep app launch events from file opens
-   shut backend down on quit

### Preload bridge

`desktop/src/preload.ts`

Expose only safe desktop APIs through `contextBridge`.

Suggested bridge:

```text
window.electronDesktop = {
  pickFile,
  pickFolder,
  openRecent,
  listRecents,
  clearRecent,
  checkForUpdates,
  dismissUpdateBanner,
  getPlatform,
  getAppVersion,
}
```

### Browser window configuration

Use:

-   `contextIsolation: true`
-   `nodeIntegration: false`
-   `sandbox: true` if compatible
-   preload script only

### Native dialogs

Electron owns the picker UX, not the Python backend.

#### Open file dialog

-   markdown-only filters:
    -   `.md`
    -   `.markdown`

#### Open folder dialog

-   allow directory selection only

### Single-window rule

For v1:

-   one app window only
-   reuse existing multi-tab support inside the web app

If the user tries to open a file from the OS while the app is already open:

-   focus the existing window
-   open the selected file in the running session

---

## Picker, Recents, and Desktop UX

### Picker-first overlay

When the desktop app loads in `mode = "empty"`, the frontend shows a full-screen or centered modal overlay with:

-   recent files
-   recent folders
-   **Open file**
-   **Open folder**

Suggested UX copy:

```text
Open a markdown file or workspace folder
Recent
[file list]
[folder list]
[Open file] [Open folder]
```

### Recents storage

Store recents in Electron, not in Python.

Recommended storage:

-   `electron-store`

Schema:

```json
{
  "recents": [
    {
      "id": "stable-id",
      "path": "/absolute/path",
      "type": "file" | "folder",
      "name": "Display name",
      "lastOpenedAt": "2026-03-25T12:00:00Z"
    }
  ],
  "dismissedUpdateVersion": "0.7.5"
}
```

Rules:

-   deduplicate by absolute path
-   newest first
-   validate existence before opening
-   remove invalid entries when encountered
-   cap list length, e.g. 12 entries

### Empty-folder UX

When `open-folder` returns `isEmptyFolder = true`, show:

```text
This folder has no markdown files yet.
[Create first note]
```

Flow:

1.  user clicks **Create first note**
2.  prompt for filename, default `Untitled.md`
3.  create file via backend route
4.  open file in the editor

### Reopen picker

Add a desktop action in the app menu and optionally the UI:

-   **Open another file**
-   **Open another folder**
-   **Back to picker**

Returning to picker should close the active workspace session via `POST /api/desktop/close-workspace`.

---

## File Associations

### File types

Register:

-   `.md`
-   `.markdown`

### Expected behavior

If the user double-clicks an associated file:

-   app opens
-   if no existing instance: launch app and open file directly
-   if app already running: send the file path to the existing instance and focus the window

### Platform packaging implications

#### macOS

Declare document types in Electron builder config.

#### Windows

Declare file associations in NSIS / Electron Builder config.

---

## Offline Asset Plan

### Goal

Remove CDN dependence from the editor so the Electron app works fully offline.

### Vendor directory

Add:

```text
markdown_os/static/vendor/
  katex/
  marked/
  turndown/
  turndown-plugin-gfm/
  mermaid/
  svg-pan-zoom/
  highlightjs/
  html2pdf/
```

### Script

Add:

```text
scripts/download_vendor.py
```

Responsibilities:

-   download pinned versions of all current CDN assets
-   place them into `markdown_os/static/vendor/`
-   download all highlight.js theme files needed by current theme logic
-   be re-runnable

### Frontend changes

Update `markdown_os/static/index.html`:

-   replace CDN `<script>` tags with local `/static/vendor/...` paths
-   replace CDN `<link>` stylesheet tags with local vendor files
-   keep exact version pinning in filenames or a manifest

### Theme coverage

Ensure vendored files cover all existing app themes:

-   light
-   dark
-   dracula
-   nord-light
-   nord-dark
-   lofi

### Offline testing requirements

Smoke tests must verify all of the following without internet access:

-   editor loads
-   theme switching works
-   syntax highlighting works
-   Mermaid renders
-   KaTeX renders
-   PDF export works if still enabled

---

## Landing Page and Downloads Spec

### Landing page behavior

Update `site/index.html` to include:

-   OS detection for macOS / Windows
-   a primary CTA button:
    -   **Download for macOS**
    -   **Download for Windows**
-   fallback button:
    -   **See all downloads**

### OS detection rules

Client-side detection is sufficient:

-   macOS if `navigator.userAgent` / platform indicates Mac
-   Windows if it indicates Windows
-   otherwise fallback to downloads page

### Latest-version default

The latest release should always be the default download target for the detected OS.

### Downloads subpage

Add:

```text
site/downloads.html
```

Requirements:

-   latest release shown first
-   older releases listed below
-   OS-specific asset grouping
-   clear labels for:
    -   macOS
    -   Windows
-   links to installer assets

### Release metadata source

For v1, populate download links from the GitHub Releases API.

Behavior:

-   landing page fetches latest release data
-   downloads page fetches release list
-   latest matching asset is used for primary CTA
-   older versions are listed when easily available from the API

### Asset naming convention

Use predictable filenames so the site can match assets reliably.

Recommended:

```text
markdown-os-desktop-0.8.0-macos.dmg
markdown-os-desktop-0.8.0-windows-setup.exe
```

If architecture-specific builds are needed later:

```text
markdown-os-desktop-0.8.0-macos-universal.dmg
markdown-os-desktop-0.8.0-windows-x64-setup.exe
```

### If older versions become hard to surface

Fallback rule:

-   latest version support is mandatory
-   older versions list is best-effort using GitHub Releases API

---

## Update Banner Spec

### Update source

Check GitHub Releases for the latest release at app startup.

### Banner placement

Show a small footer banner in the sidebar area.

Suggested content:

```text
Update available: 0.8.1
[Download] [Dismiss]
```

### Behavior

-   banner appears on app launch if a newer version exists
-   dismiss is persisted per version
-   download opens the release page or direct installer URL in the OS browser

### Version comparison

Use semver comparison on the desktop app version vs latest GitHub release tag.

### Out of scope for v1

-   background installer download
-   silent update installation
-   in-place binary replacement

---

## Packaging Spec

### Desktop dependencies

Add Node/Electron tooling:

-   `electron`
-   `electron-builder`
-   `typescript`
-   `electron-store`

Optional helper:

-   `electron-log`

### Python bundling strategy

Bundle a self-contained Python runtime plus the Markdown-OS package and dependencies inside the Electron app.

Recommended approach:

-   create a per-platform packaged Python environment during CI
-   include it in the desktop build artifact
-   spawn that runtime from Electron

This avoids requiring users to install Python.

### Installers

#### macOS

-   `.dmg`

#### Windows

-   NSIS `.exe`

### Signing / notarization

For the first iteration:

-   ship **unsigned** installers to keep build complexity low

Known consequence:

-   macOS and Windows may show trust/security prompts during install or first open

This does not block functionality, but it is a follow-up item for smoother end-user trust UX.

---

## CI/CD Spec

### New workflow

Add:

```text
.github/workflows/desktop-release.yml
```

### Trigger

Recommended:

-   run on version tags `v*`
-   after the Python/PyPI release path or in parallel with it

### Build matrix

-   `macos-latest`
-   `windows-latest`

### Workflow steps

1.  checkout
2.  setup Node
3.  setup Python / `uv`
4.  install Python app dependencies
5.  vendor frontend assets
6.  build bundled Python runtime payload
7.  install Electron dependencies
8.  build desktop app installers
9.  run smoke tests
10. upload artifacts to GitHub Release

### Smoke-test checklist

Per platform:

-   app starts
-   picker is shown first
-   open markdown file works
-   open folder works
-   open empty folder works
-   create first note works
-   close app shuts backend down
-   offline asset rendering works
-   recents update after open

### Release assets

Upload:

-   macOS installer
-   Windows installer
-   optional checksums file

---

## Frontend/Desktop Integration Spec

### Desktop detection

Expose a desktop bridge on `window.electronDesktop`.

Frontend uses presence of the bridge to:

-   show picker overlay
-   show recents
-   show update banner
-   disable browser-only assumptions

### UI modules to add

Suggested frontend files:

```text
markdown_os/static/js/desktop-shell.js
markdown_os/static/js/desktop-picker.js
markdown_os/static/js/desktop-updates.js
```

Responsibilities:

#### `desktop-shell.js`

-   detect Electron mode
-   bootstrap desktop UI behaviors

#### `desktop-picker.js`

-   render picker overlay
-   render recents
-   call Electron bridge actions
-   handle empty-folder create-first-note flow

#### `desktop-updates.js`

-   render update banner
-   dismiss banner
-   open update link

### Menu items

Desktop app menu should include:

-   Open file
-   Open folder
-   Back to picker
-   Recent files
-   Recent folders
-   Check for updates

---

## Files to Change

| File | Change |
| --- | --- |
| `markdown_os/cli.py` | Extract reusable startup and validation logic; keep CLI behavior unchanged |
| `markdown_os/server.py` | Add desktop mode, empty state support, health route, desktop open/close/create routes |
| `markdown_os/desktop_runtime.py` | New file — desktop backend entrypoint |
| `markdown_os/static/index.html` | Add desktop-specific scripts; replace CDN assets with local vendor paths |
| `markdown_os/static/js/desktop-shell.js` | New file — Electron mode bootstrap |
| `markdown_os/static/js/desktop-picker.js` | New file — picker, recents, create-first-note flow |
| `markdown_os/static/js/desktop-updates.js` | New file — update banner |
| `markdown_os/static/js/theme.js` | Adjust theme asset resolution for vendored highlight themes if needed |
| `markdown_os/static/vendor/**` | New vendored frontend dependencies |
| `scripts/download_vendor.py` | New or restored script to fetch pinned frontend assets |
| `desktop/package.json` | New file — Electron package metadata and scripts |
| `desktop/tsconfig.json` | New file — TypeScript config for desktop shell |
| `desktop/electron-builder.yml` | New file — installer targets, associations, build metadata |
| `desktop/src/main.ts` | New file — Electron main process |
| `desktop/src/preload.ts` | New file — preload bridge |
| `desktop/src/backend.ts` | New file — backend process lifecycle helpers |
| `desktop/src/dialogs.ts` | New file — native file/folder dialog helpers |
| `desktop/src/recents.ts` | New file — recents persistence |
| `desktop/src/updater.ts` | New file — GitHub release/update checks |
| `site/index.html` | Add OS-aware download CTA logic |
| `site/downloads.html` | New file — list latest and older desktop downloads |
| `README.md` | Add desktop install docs and release/download notes |
| `.github/workflows/desktop-release.yml` | New file — macOS/Windows desktop build and release workflow |
| `tests/test_server.py` | Add desktop route tests |
| `tests/test_cli.py` | Add or adjust startup helper tests if logic is extracted |
| `tests/test_desktop_runtime.py` | New file — backend desktop-mode tests |

---

## Testing Plan

### Automated tests

#### Python tests

-   desktop empty-mode state
-   open file route
-   open folder route
-   empty-folder acceptance
-   create-first-note route
-   close-workspace route
-   path validation parity between CLI and desktop mode

#### Desktop tests

Use targeted Electron tests for:

-   app startup
-   picker visibility
-   open file
-   open folder
-   recents persistence
-   update banner visibility logic

### Manual smoke tests

#### macOS

-   install app
-   first launch shows picker
-   open file
-   open folder
-   open empty folder
-   create first note
-   verify themes
-   verify Mermaid / KaTeX / syntax highlighting offline
-   close app and confirm backend stops

#### Windows

-   same set as macOS

### Landing page tests

-   macOS user agent shows **Download for macOS**
-   Windows user agent shows **Download for Windows**
-   unknown user agent falls back to downloads page
-   downloads page lists latest release first
-   older release links render when available

---

## Implementation Phases

### Phase 1 — Backend desktop mode

-   extract startup helpers from CLI
-   add desktop runtime entrypoint
-   add empty state and desktop APIs
-   support empty folders and first-note creation

### Phase 2 — Offline asset vendoring

-   vendor CDN dependencies
-   patch editor HTML and theme handling
-   verify full offline behavior

### Phase 3 — Electron shell MVP

-   add Electron app project
-   implement backend spawning
-   implement picker and recents
-   implement single-window shell
-   implement graceful shutdown

### Phase 4 — Distribution surface

-   add GitHub desktop release workflow
-   add landing page OS-aware download CTA
-   add downloads page

### Phase 5 — Desktop polish

-   add file associations
-   add update banner
-   refine menu items and recents interactions

---

## Out of Scope

-   Linux desktop packaging
-   Multiple desktop windows in v1
-   Self-installing auto-updates
-   Code signing and notarization in v1
-   Non-GitHub distribution hosting
-   Mobile app support
-   Rewriting the editor UI in Electron-native components
