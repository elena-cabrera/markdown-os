# Feature Plan: Electron Desktop App

## Goal

Ship a native desktop app for **macOS** and **Windows** that lets a user:

-   download Markdown-OS from the landing page
-   install and open it like a normal desktop app
-   choose a markdown file or folder from native OS dialogs
-   use the existing editor without touching a terminal

When the user closes the app, the embedded backend process must shut down cleanly.

The desktop app must:

-   start on a picker-first screen every launch
-   show recent files and folders
-   open a markdown file or a folder workspace
-   allow empty folders and offer **Create first note**
-   preserve current in-app multi-tab behavior
-   work fully offline after installation
-   expose downloadable installers from the landing page
-   expose a downloads page with latest release first and older releases below
-   support file associations for `.md` and `.markdown`
-   show a dismissible in-app update banner when a newer release exists

---

## Current Repo Reality

### What already exists

The desktop plan should build on current behavior instead of replacing it.

-   `markdown_os/cli.py` already resolves a target path, detects `file` vs `folder`, finds an open port, opens a browser, and starts Uvicorn.
-   `markdown_os/server.py` already serves the editor shell, file content APIs, file-tree APIs, image uploads, and websocket change notifications.
-   `markdown_os/directory_handler.py` already supports empty folder workspaces, file creation, rename, and delete.
-   `tests/test_server.py` already covers empty folder mode returning an empty file tree.
-   `markdown_os/static/index.html` already contains a generic empty state, file tabs, file tree actions, PDF export, and focus mode.
-   `site/index.html` already serves as the marketing/landing page and currently promotes CLI installation.
-   `.github/workflows/publish.yml` already publishes tagged releases to PyPI.

### What does not exist yet

-   No desktop runtime entrypoint.
-   No `empty` backend mode.
-   No way to swap the active workspace after the server has already started.
-   No Electron shell, preload bridge, recents store, or updater.
-   No vendored frontend assets; the app still depends on public CDNs.
-   No downloads page in `site/`.
-   No desktop release workflow for macOS/Windows installers.

### Important correction

The current repo already accepts empty folder workspaces in browser/CLI folder mode. The desktop plan does **not** need special folder validation to allow empties; it needs:

-   picker-first app startup
-   dynamic workspace switching after startup
-   a better empty-folder UX inside desktop mode

---

## Product Decisions

### Supported platforms

-   **macOS**
-   **Windows**

Linux is out of scope for v1.

### Launch behavior

Every app launch opens a picker-first shell with:

-   recent files
-   recent folders
-   **Open file**
-   **Open folder**

The app does **not** auto-open the last workspace on startup. Recents are shown, but the user explicitly chooses what to open.

### Workspace behavior

-   single desktop window in v1
-   reuse existing browser editor UI inside the window
-   keep current tab behavior unchanged
-   empty folders are valid
-   empty folders show a focused **Create first note** action

### Distribution behavior

-   desktop installers are distributed through **GitHub Releases**
-   the landing page shows an OS-aware default desktop download button
-   the site keeps CLI install instructions, because the Python package still exists
-   a dedicated downloads page lists desktop assets by release

### Update behavior

The desktop app checks GitHub Releases at startup.

If a newer release exists, show a dismissible sidebar-footer banner with:

-   latest version number
-   **Download update**
-   **Dismiss**

For v1, updates are download-only. Silent/self-installing updates are out of scope.

### Versioning behavior

Use the existing tag format `vX.Y.Z` as the release source for:

-   PyPI package publishing
-   desktop installer publishing
-   desktop update checks
-   site download links

The desktop app version should match the package version for the same release tag.

---

## Architecture

### High-level approach

Keep the existing Python FastAPI backend and static frontend as the editor runtime, then wrap them with Electron.

Runtime flow:

1.  Electron starts.
2.  Electron spawns a bundled Python backend process on `127.0.0.1`.
3.  The backend starts in `empty` mode.
4.  Electron opens a `BrowserWindow` pointed at the local backend URL.
5.  The frontend shows the desktop picker overlay.
6.  Electron opens a native file/folder dialog on demand.
7.  The chosen absolute path is sent to the backend over HTTP.
8.  The backend switches from `empty` to `file` or `folder`.
9.  Existing editor UI handles editing, tabs, saves, and websocket updates.
10.  On app quit, Electron shuts the backend down gracefully.

### Why this approach

-   reuses current FastAPI routes and most frontend modules
-   avoids rewriting the editor in React/Electron-native UI
-   keeps desktop-specific logic isolated to shell, packaging, picker UX, recents, and updates
-   preserves the current markdown rendering and save pipeline

### Key architectural requirement: dynamic workspace sessions

The current server lifecycle assumes the handler and watcher are known at app creation time.

That is not enough for Electron, because the app must:

-   start with **no workspace loaded**
-   open a file later
-   close that workspace
-   open a different folder later

The desktop plan therefore needs a dedicated session controller instead of storing raw `handler` and `mode` directly on `app.state`.

---

## Backend Spec

### 1\. Extract shared runtime helpers

Add:

```text
markdown_os/app_runtime.py

```

Move CLI/runtime helpers out of `markdown_os/cli.py` so both CLI and desktop can reuse them.

Suggested functions:

-   `resolve_target_path(path: Path, *, allow_file: bool = True, allow_folder: bool = True) -> tuple[Path, str]`
-   `build_handler_for_target(path: Path, mode: str) -> FileHandler | DirectoryHandler`
-   `find_available_port(host: str = "127.0.0.1", start_port: int = 8000) -> int`
-   `build_editor_app(*, mode: str, handler: FileHandler | DirectoryHandler | None, desktop: bool = False) -> FastAPI`

Rules:

-   CLI behavior stays unchanged.
-   Desktop mode reuses the same path validation rules.
-   Empty folders remain valid in folder mode, matching current behavior.

### 2\. Add a workspace session controller

Add:

```text
markdown_os/workspace_session.py

```

This object owns mutable runtime state for the current desktop session.

Suggested responsibilities:

-   track `mode`: `"empty" | "file" | "folder"`
-   track current handler or `None`
-   track `current_file`
-   track `workspace_path`
-   track whether the folder is empty
-   own the watchdog `Observer`
-   stop/restart watchers when workspace changes
-   clean up handler lock files on close
-   expose current health/state payloads

Suggested API:

```text
WorkspaceSession
  open_file(path: Path) -> dict[str, object]
  open_folder(path: Path) -> dict[str, object]
  close_workspace() -> None
  snapshot() -> dict[str, object]
  mark_internal_write() -> None
  cleanup() -> None

```

This is the main backend refactor that makes Electron viable.

### 3\. Extend server modes

Update `markdown_os/server.py` so `create_app(...)` accepts:

-   `mode = "empty" | "file" | "folder"`
-   `handler = None` when mode is `empty`
-   `desktop = True | False`

Behavior in `empty` mode:

-   `/` still serves the editor shell
-   `/api/mode` returns `{"mode": "empty"}`
-   routes that require a loaded workspace return a clear `409` response with `detail = "No workspace loaded."`
-   websocket endpoint still exists, but no watcher is active

### 4\. Desktop-specific routes

Add desktop routes only when `desktop=True`.

#### `GET /api/health`

Response:

```json
{ "ok": true, "desktop": true, "mode": "empty" }

```

Purpose:

-   Electron readiness probe
-   backend health checks after startup
-   backend health checks before graceful shutdown

#### `GET /api/desktop/state`

Response:

```json
{
  "mode": "empty" | "file" | "folder",
  "workspacePath": "/absolute/path/or/null",
  "currentFile": "relative/path/or/null",
  "isEmptyWorkspace": false
}

```

#### `POST /api/desktop/open-file`

Body:

```json
{ "path": "/absolute/path/to/file.md" }

```

Behavior:

-   validate the file with existing markdown file rules
-   close any current session
-   open a new `FileHandler`
-   start the correct watcher
-   switch mode to `file`

Response:

```json
{
  "ok": true,
  "mode": "file",
  "workspacePath": "/absolute/path/to/file.md"
}

```

#### `POST /api/desktop/open-folder`

Body:

```json
{ "path": "/absolute/path/to/folder" }

```

Behavior:

-   validate the directory exists
-   close any current session
-   open a new `DirectoryHandler`
-   start a recursive watcher
-   detect whether there are any markdown files
-   switch mode to `folder`

Response:

```json
{
  "ok": true,
  "mode": "folder",
  "workspacePath": "/absolute/path/to/folder",
  "isEmptyWorkspace": true
}

```

#### `POST /api/desktop/close-workspace`

Behavior:

-   stop the active watcher
-   clean up the active handler
-   clear mode/handler/current file
-   return to `empty`

Response:

```json
{ "ok": true, "mode": "empty" }

```

### 5\. Reuse existing folder APIs

Do **not** add a desktop-only `create-first-note` backend route.

Once an empty folder is open in normal folder mode, reuse existing APIs:

-   `POST /api/files/create`
-   `GET /api/file-tree`
-   `GET /api/content?file=...`

That keeps desktop-specific backend surface smaller and reuses tested logic already in the repo.

### 6\. Graceful shutdown

Add:

```text
markdown_os/desktop_runtime.py

```

Responsibilities:

-   start the FastAPI app in desktop mode
-   bind to `127.0.0.1`
-   print a machine-readable readiness line with the final URL/port
-   handle termination signals cleanly
-   call workspace-session cleanup on exit

Shutdown order:

1.  Electron sends a polite termination request to the Python child.
2.  Backend exits Uvicorn normally.
3.  Workspace session stops observer and cleans handler resources.
4.  Electron only force-kills if the child fails to exit in time.

---

## Frontend/Desktop Integration

### Desktop detection

Expose a preload bridge as `window.electronDesktop`.

Frontend uses the bridge to:

-   detect desktop mode
-   open native pickers
-   read/write recents
-   launch update URLs in the OS browser
-   query platform/app version metadata

### New frontend modules

Add:

```text
markdown_os/static/js/desktop-shell.js
markdown_os/static/js/desktop-picker.js
markdown_os/static/js/desktop-updates.js

```

Responsibilities:

#### `desktop-shell.js`

-   detect Electron presence
-   fetch `/api/desktop/state`
-   bootstrap desktop-only UI state
-   expose helpers to return to picker mode

#### `desktop-picker.js`

-   render the picker-first overlay
-   render recent files/folders
-   trigger `pickFile()` / `pickFolder()`
-   call desktop open routes after a path is selected
-   handle empty-folder UX

#### `desktop-updates.js`

-   render the update banner
-   dismiss the banner for a specific version
-   open the release/download URL

### Empty state behavior

There are two distinct empty states:

#### App start, no workspace loaded

Show a desktop picker overlay with:

-   **Open file**
-   **Open folder**
-   recent files
-   recent folders

#### Empty folder workspace

After opening a folder with no markdown files:

-   keep folder mode active
-   show the existing main editor shell
-   replace the current generic empty-state copy with desktop-specific copy:

```text
This folder has no markdown files yet.
[Create first note]

```

Implementation detail:

-   `Create first note` should call the existing `POST /api/files/create`
-   default filename: `Untitled.md`
-   on success, open the new file using existing folder-mode navigation/tab logic

### Existing modules to extend

#### `markdown_os/static/index.html`

-   add desktop scripts
-   add container markup for picker/update UI
-   swap CDN assets to local vendor files

#### `markdown_os/static/js/editor.js`

-   handle `mode = "empty"`
-   avoid assuming a workspace exists on initial load
-   coordinate picker open/close transitions

#### `markdown_os/static/js/file-tree.js`

-   continue to own `POST /api/files/create`
-   expose or reuse the existing create-file flow for empty-folder CTA

#### `markdown_os/static/js/tabs.js`

-   gracefully handle transition back to `empty`
-   clear open tabs when `Back to picker` closes the current workspace

### Desktop menu items

Desktop app menu should include:

-   Open file
-   Open folder
-   Back to picker
-   Recent files
-   Recent folders
-   Check for updates

---

## Electron App Spec

### Project layout

Add:

```text
desktop/
  package.json
  tsconfig.json
  electron-builder.yml
  src/
    main.ts
    preload.ts
    backend.ts
    dialogs.ts
    recents.ts
    updater.ts

```

### Main process responsibilities

`desktop/src/main.ts`

-   enforce single-instance lock
-   create a single `BrowserWindow`
-   spawn the bundled Python backend
-   wait for `/api/health`
-   load the backend URL
-   register app menu items
-   handle OS-level file-open events
-   forward second-instance file opens to the running app
-   shut backend down on quit

### Preload bridge

`desktop/src/preload.ts`

Expose only safe functions:

```text
window.electronDesktop = {
  pickFile,
  pickFolder,
  listRecents,
  openRecent,
  clearRecent,
  getPlatform,
  getAppVersion,
  getReleaseFeedUrl,
  dismissUpdateVersion,
  getDismissedUpdateVersion,
  openExternalUrl,
}

```

### BrowserWindow configuration

Use:

-   `contextIsolation: true`
-   `nodeIntegration: false`
-   `sandbox: true` if Electron dependencies remain compatible
-   preload script only

### Native dialog behavior

Electron owns OS dialogs.

#### File picker

-   allow `.md`
-   allow `.markdown`

#### Folder picker

-   folder selection only

### Single-window behavior

For v1:

-   one desktop window only
-   reuse existing in-app tabs instead of multiple app windows

If the user opens a file from Finder/Explorer while the app is already open:

-   focus the existing window
-   call the desktop open-file route
-   add/update the recent entry

---

## Recents, File Associations, and Updates

### Recents storage

Store recents in Electron, not Python.

Recommended dependency:

-   `electron-store`

Suggested schema:

```json
{
  "recents": [
    {
      "path": "/absolute/path",
      "type": "file" | "folder",
      "name": "Display name",
      "lastOpenedAt": "2026-03-25T12:00:00Z"
    }
  ],
  "dismissedUpdateVersion": "0.8.0"
}

```

Rules:

-   deduplicate by absolute path
-   newest first
-   cap length, for example 12 items
-   drop missing paths when encountered

### File associations

Register:

-   `.md`
-   `.markdown`

Platform notes:

#### macOS

-   declare document types in Electron Builder config

#### Windows

-   declare file associations in NSIS/Electron Builder config

### Update banner

Check GitHub Releases on startup.

Banner copy:

```text
Update available: 0.8.1
[Download] [Dismiss]

```

Behavior:

-   compare current app version vs latest release tag with semver
-   persist dismissals per version
-   `Download` opens the release page or platform asset URL in the OS browser

Out of scope for v1:

-   silent background downloads
-   in-place binary replacement
-   auto-install on restart

---

## Offline Asset Plan

### Goal

Remove CDN dependence from the editor so installed desktop builds work offline.

### Current CDN dependencies to vendor

The current app loads these remotely and all of them must become local assets:

-   KaTeX CSS
-   KaTeX JS
-   DOMPurify
-   Marked
-   Turndown
-   Turndown GFM plugin
-   Mermaid
-   svg-pan-zoom
-   highlight.js JS
-   highlight.js theme CSS
-   html2pdf

### Vendor directory

Add:

```text
markdown_os/static/vendor/
  katex/
  dompurify/
  marked/
  turndown/
  turndown-plugin-gfm/
  mermaid/
  svg-pan-zoom/
  highlightjs/
  html2pdf/

```

### Vendor sync script

Add:

```text
scripts/download_vendor.py

```

Responsibilities:

-   download pinned versions of all frontend vendor assets
-   write them under `markdown_os/static/vendor/`
-   include every highlight.js theme required by `theme.js`
-   be re-runnable and deterministic

### Frontend changes

Update `markdown_os/static/index.html` to:

-   replace CDN `<script>` tags with `/static/vendor/...`
-   replace CDN `<link>` tags with local files
-   keep current versions pinned

### Offline acceptance checklist

Desktop smoke tests must verify, without internet access:

-   editor shell loads
-   theme switching still works
-   syntax highlighting still works
-   Mermaid rendering still works
-   KaTeX rendering still works
-   PDF export still works

---

## Packaging Spec

### Desktop dependencies

Add a Node/Electron toolchain under `desktop/`:

-   `electron`
-   `electron-builder`
-   `typescript`
-   `electron-store`

Optional:

-   `electron-log`

### Python bundling strategy

Bundle a self-contained Python runtime plus the Markdown-OS package and its dependencies inside the desktop app.

Recommended approach:

-   build a per-platform Python payload in CI
-   include that payload inside the Electron package
-   spawn the bundled runtime from Electron

The desktop installer must not require the user to install Python separately.

### Installer targets

#### macOS

-   `.dmg`

#### Windows

-   NSIS `.exe`

### Signing and notarization

For v1:

-   ship unsigned installers

Known consequence:

-   macOS and Windows will show trust/security prompts

Signing/notarization is follow-up work, not part of this feature.

---

## Landing Page and Downloads

### Landing page changes

Update `site/index.html` to add desktop download CTAs **without removing** the current CLI install widget.

Behavior:

-   detect macOS vs Windows on the client
-   show a primary CTA:
    -   **Download for macOS**
    -   **Download for Windows**
-   show a secondary CTA:
    -   **See all downloads**

This page should still support users who want the Python/CLI install path.

### Downloads page

Add:

```text
site/downloads.html

```

Requirements:

-   latest release first
-   older releases below
-   assets grouped by OS
-   clear labels for macOS and Windows
-   links to installer artifacts

### Release metadata source

Use the GitHub Releases API for desktop assets.

Behavior:

-   landing page fetches latest release data
-   downloads page fetches release list
-   asset matching uses predictable filenames

Recommended filenames:

```text
markdown-os-desktop-0.8.0-macos.dmg
markdown-os-desktop-0.8.0-windows-setup.exe

```

If architecture-specific builds are needed later:

```text
markdown-os-desktop-0.8.0-macos-universal.dmg
markdown-os-desktop-0.8.0-windows-x64-setup.exe

```

### Site implementation notes

Keep the site static.

That means:

-   inline JS or a small shared site script is fine
-   no frontend build step should be introduced for the marketing site

---

## CI/CD Spec

### New workflow

Add:

```text
.github/workflows/desktop-release.yml

```

### Trigger

Run on version tags `v*`, alongside the existing PyPI publish workflow.

### Build matrix

-   `macos-latest`
-   `windows-latest`

### Workflow steps

1.  checkout repo
2.  setup Node
3.  setup Python / `uv`
4.  install Python app deps
5.  download/vendor frontend assets
6.  build bundled Python payload
7.  install desktop deps
8.  package installers
9.  run targeted smoke tests
10.  upload assets to the GitHub Release

### Smoke-test checklist

Per platform:

-   desktop app starts
-   picker screen appears first
-   open file works
-   open folder works
-   open empty folder works
-   create first note works
-   recents update after open
-   update check logic runs
-   closing app shuts backend down
-   offline asset rendering works

### Release outputs

Upload:

-   macOS installer
-   Windows installer
-   optional checksum file

---

## Files to Change

| File | Change |
| --- | --- |
| `markdown_os/cli.py` | Extract reusable runtime helpers; preserve existing CLI UX |
| `markdown_os/app_runtime.py` | New file - shared runtime/path/port helpers |
| `markdown_os/workspace_session.py` | New file - dynamic workspace and watcher lifecycle controller |
| `markdown_os/server.py` | Add `empty` mode, desktop routes, and workspace-session integration |
| `markdown_os/desktop_runtime.py` | New file - desktop backend entrypoint |
| `markdown_os/static/index.html` | Add desktop scripts/containers and replace CDN assets with local vendor assets |
| `markdown_os/static/js/editor.js` | Support `empty` mode and desktop transitions |
| `markdown_os/static/js/file-tree.js` | Reuse/create desktop empty-folder file creation flow |
| `markdown_os/static/js/tabs.js` | Clear tabs when returning to picker and handle desktop workspace resets |
| `markdown_os/static/js/theme.js` | Point highlight theme loading at vendored files if needed |
| `markdown_os/static/js/desktop-shell.js` | New file - Electron mode bootstrap |
| `markdown_os/static/js/desktop-picker.js` | New file - picker UI, recents, empty-folder CTA |
| `markdown_os/static/js/desktop-updates.js` | New file - update banner |
| `markdown_os/static/vendor/**` | New vendored frontend dependencies |
| `scripts/download_vendor.py` | New file - deterministic vendor sync script |
| `desktop/package.json` | New file - desktop package metadata and scripts |
| `desktop/tsconfig.json` | New file - desktop TypeScript config |
| `desktop/electron-builder.yml` | New file - installer targets, file associations, packaging config |
| `desktop/src/main.ts` | New file - Electron main process |
| `desktop/src/preload.ts` | New file - secure preload bridge |
| `desktop/src/backend.ts` | New file - backend child process lifecycle helpers |
| `desktop/src/dialogs.ts` | New file - native open-file/open-folder helpers |
| `desktop/src/recents.ts` | New file - recents persistence |
| `desktop/src/updater.ts` | New file - GitHub release/update checks |
| `site/index.html` | Add OS-aware desktop download CTA while retaining CLI install UI |
| `site/downloads.html` | New file - desktop downloads page |
| `README.md` | Add desktop install/download docs |
| `.github/workflows/desktop-release.yml` | New file - desktop packaging and release workflow |
| `tests/test_cli.py` | Add shared runtime extraction tests where relevant |
| `tests/test_server.py` | Add desktop route and empty-mode coverage |
| `tests/test_workspace_session.py` | New file - dynamic session/watcher lifecycle tests |
| `tests/test_desktop_runtime.py` | New file - desktop backend startup/shutdown tests |

---

## Testing Plan

### Python automated tests

-   empty-mode app state
-   desktop open-file route
-   desktop open-folder route
-   desktop close-workspace route
-   empty-mode route guarding
-   workspace-session watcher swap behavior
-   shared runtime helper parity with current CLI validation

### Electron/desktop automated tests

Use targeted desktop tests for:

-   app startup
-   picker visibility
-   open file
-   open folder
-   empty-folder create-first-note
-   recents persistence
-   update banner visibility logic

### Manual smoke tests

#### macOS

-   install app
-   first launch shows picker
-   open markdown file
-   open folder
-   open empty folder
-   create first note
-   verify themes
-   verify Mermaid / KaTeX / syntax highlighting offline
-   close app and verify backend exits

#### Windows

-   same checklist as macOS

### Site tests

-   macOS user agent shows **Download for macOS**
-   Windows user agent shows **Download for Windows**
-   unknown user agent falls back to downloads page
-   downloads page lists latest release first
-   older release links render when available

---

## Implementation Phases

### Phase 1 - Shared runtime and session controller

-   extract reusable CLI/runtime helpers
-   add workspace-session controller
-   support `empty` mode and dynamic watcher lifecycle

### Phase 2 - Desktop backend and frontend shell

-   add desktop runtime entrypoint
-   add desktop routes
-   add picker overlay
-   add return-to-picker behavior
-   add empty-folder `Create first note` UX using existing file-create API

### Phase 3 - Offline asset vendoring

-   vendor every current CDN asset
-   patch `index.html` and theme loading
-   verify offline rendering and PDF export

### Phase 4 - Electron shell and installers

-   add `desktop/` project
-   implement backend spawning
-   implement native dialogs, recents, and file associations
-   package macOS and Windows installers

### Phase 5 - Distribution surface

-   add desktop release workflow
-   add landing page desktop CTA
-   add downloads page
-   add in-app update banner

---

## Risks

-   **Watcher lifecycle complexity:** current observer setup is static; dynamic swapping is the largest backend change.
-   **Bundled Python size:** packaging a Python runtime inside Electron will increase artifact size.
-   **Offline asset drift:** every CDN dependency must stay pinned and reproducible.
-   **Unsigned installers:** first-launch trust prompts will exist until signing/notarization is added.
-   **Dual distribution UX:** the site must present desktop downloads without breaking the current CLI/PyPI flow.

---

## Out of Scope

-   Linux desktop packaging
-   multiple desktop windows
-   self-installing auto-updates
-   code signing and notarization
-   non-GitHub distribution hosting
-   mobile apps
-   rewriting the editor UI in Electron-native components