# Desktop App Implementation Plan: pywebview + PyInstaller

## Overview
Add a desktop app mode to Markdown-OS using **pywebview** for the native window and **PyInstaller** for packaging. The existing CLI continues to work unchanged. CDN dependencies will be bundled locally for offline use.

---

## Step 1: Bundle CDN Assets Locally

**Goal**: Download all CDN JS/CSS libraries into `markdown_os/static/vendor/` so the app works offline.

**Files to create**:
- `markdown_os/static/vendor/js/` — JS libraries (marked, turndown, mermaid, katex, dompurify, highlight, svg-pan-zoom, html2pdf)
- `markdown_os/static/vendor/css/` — CSS files (katex.min.css, highlight themes)
- `markdown_os/static/vendor/fonts/` — KaTeX fonts (required for math rendering)
- `scripts/download_vendor.py` — Script to download all vendor assets (for reproducibility)

**Files to modify**:
- `markdown_os/static/index.html` — Change CDN URLs to local `/static/vendor/...` paths

**Libraries to bundle** (from index.html):
1. DOMPurify 3.3.1
2. Marked.js 15.0.12
3. Turndown 7.2.0
4. turndown-plugin-gfm 1.0.2
5. Mermaid 10.9.5
6. KaTeX 0.16.21 (JS + CSS + fonts)
7. highlight.js 11.9.0 (JS + multiple theme CSS files)
8. svg-pan-zoom 3.6.1
9. html2pdf.js 0.10.2

---

## Step 2: Add "Open File/Folder" UI for Desktop Mode

**Goal**: Non-technical users need a way to open files/folders without CLI arguments.

### 2a: Welcome/Landing Screen
When the desktop app launches with no path argument, show a **welcome screen** instead of the editor:

- Centered card with the Markdown-OS logo/name
- Two prominent buttons: **"Open File"** and **"Open Folder"**
- These trigger **native OS file/folder picker dialogs** via pywebview's JS-Python bridge (`window.create_file_dialog()`)
- After selection, the app starts the server for that path and navigates to the editor
- Also show a "Recent Files" list (stored in localStorage) for quick re-opening

**Files to create**:
- `markdown_os/static/welcome.html` — Standalone welcome page with Open File / Open Folder buttons
- `markdown_os/static/css/welcome.css` — Styling for the welcome screen
- `markdown_os/static/js/welcome.js` — JS for file dialog triggers and recent files

### 2b: "Open" Button in Editor Toolbar
Once in the editor, users should be able to switch to a different file/folder:

- Add a small **folder icon button** in the top-left of the `tab-nav` bar (next to undo/redo)
- Clicking it shows a dropdown with "Open File..." and "Open Folder..." options
- These trigger the same native OS dialogs via pywebview's bridge
- After selection, the app restarts the server with the new path and reloads

**Files to modify**:
- `markdown_os/static/index.html` — Add the Open button to the toolbar
- `markdown_os/static/css/styles.css` — Style the Open button/dropdown
- `markdown_os/static/js/editor.js` — Handle Open button click, communicate with pywebview bridge

### 2c: Server-side "Open" API
The desktop entry point needs an API endpoint that the frontend can call to switch paths:

- `POST /api/desktop/open` — Accepts `{ "path": "..." }`, restarts the server handler
- `GET /api/desktop/mode` — Returns `{ "desktop": true/false }` so the frontend knows whether to show the Open button

**Files to modify**:
- `markdown_os/server.py` — Add desktop-aware routes (only active when `desktop=True` flag is set)

### How pywebview JS-Python bridge works:
```python
# Python side (desktop.py)
class DesktopApi:
    def open_file_dialog(self):
        result = window.create_file_dialog(webview.OPEN_DIALOG,
            file_types=('Markdown Files (*.md;*.markdown)',))
        if result:
            # restart server with new path
            return result[0]

    def open_folder_dialog(self):
        result = window.create_file_dialog(webview.FOLDER_DIALOG)
        if result:
            return result[0]

# JS side (in welcome.js / editor.js)
# window.pywebview.api.open_file_dialog()
# window.pywebview.api.open_folder_dialog()
```

---

## Step 3: Create Desktop App Entry Point

**Goal**: New module that launches the FastAPI server in a background thread and opens a pywebview native window.

**File to create**: `markdown_os/desktop.py`

**Behavior**:
1. On launch with no arguments: show the welcome screen (welcome.html)
2. On launch with a path argument: validate and open that path directly in the editor
3. Start uvicorn in a daemon thread (reuse existing `create_app()`, `find_available_port()`, etc.)
4. Create a pywebview window pointing to `http://127.0.0.1:{port}`
5. Expose `DesktopApi` class to JS via pywebview's `js_api` parameter
6. When the window closes: shut down the uvicorn server and exit cleanly

**Key design decisions**:
- Reuse all existing server infrastructure (FastAPI app, handlers, watchdog)
- The only difference from CLI mode: native window instead of system browser
- Window title: "Markdown-OS — {filename_or_foldername}"
- Window size: 1200x800 default, resizable
- pywebview's `js_api` bridges Python ↔ JS for native file dialogs

---

## Step 4: Add pywebview Dependency

**File to modify**: `pyproject.toml`

- Add `pywebview>=5.0` to a new optional dependency group `[project.optional-dependencies] desktop = ["pywebview>=5.0"]`
- Add a new entry point: `markdown-os-desktop = "markdown_os.desktop:main"`

This keeps the CLI lightweight — desktop users install with `pip install markdown-os[desktop]`.

---

## Step 5: Create PyInstaller Spec

**File to create**: `markdown_os.spec` (PyInstaller spec file)

**Configuration**:
- Entry point: `markdown_os/desktop.py`
- Bundle: entire `markdown_os/static/` directory (including vendor assets)
- Bundle: `markdown_os/templates/` directory
- Hidden imports: fastapi, uvicorn, watchdog, pywebview, etc.
- One-file mode for simpler distribution
- App name: "Markdown-OS"
- Icon: derive from existing `favicon.svg` (convert to .icns for macOS, .ico for Windows)

**File to create**: `scripts/build_desktop.py` — Build helper script that:
- Runs PyInstaller with the spec
- Handles macOS `.app` bundle and Windows `.exe` output

---

## Step 6: Tests

**File to create**: `tests/test_desktop.py`

- Test that the desktop module can create the FastAPI app correctly
- Test the server thread starts/stops cleanly
- Test the DesktopApi class methods
- Test welcome page serving
- Test argument parsing

---

## Summary of Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `scripts/download_vendor.py` | Script to download CDN assets |
| Create | `markdown_os/static/vendor/` | Bundled JS/CSS/font assets |
| Create | `markdown_os/static/welcome.html` | Welcome/landing screen for desktop mode |
| Create | `markdown_os/static/css/welcome.css` | Welcome screen styling |
| Create | `markdown_os/static/js/welcome.js` | Welcome screen JS (file dialogs, recent files) |
| Modify | `markdown_os/static/index.html` | Local vendor paths + Open button in toolbar |
| Modify | `markdown_os/static/css/styles.css` | Open button styling |
| Modify | `markdown_os/static/js/editor.js` | Open button handler + pywebview bridge |
| Modify | `markdown_os/server.py` | Desktop-aware routes (open path, desktop mode flag) |
| Create | `markdown_os/desktop.py` | Desktop app entry point with pywebview + DesktopApi |
| Modify | `pyproject.toml` | Add pywebview optional dep + desktop entry point |
| Create | `markdown_os.spec` | PyInstaller configuration |
| Create | `scripts/build_desktop.py` | Build helper script |
| Create | `tests/test_desktop.py` | Desktop module tests |

The existing CLI (`cli.py`) remains **unchanged**. All desktop features are additive and gated behind the `desktop` mode flag.
