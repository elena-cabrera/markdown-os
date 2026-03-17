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

## Step 2: Create Desktop App Entry Point

**Goal**: New module that launches the FastAPI server in a background thread and opens a pywebview native window.

**File to create**: `markdown_os/desktop.py`

**Behavior**:
1. On launch with no arguments: show a native file/folder picker dialog (pywebview has built-in file dialog support)
2. On launch with a path argument: validate and open that path directly
3. Start uvicorn in a daemon thread (reuse existing `create_app()`, `find_available_port()`, etc.)
4. Create a pywebview window pointing to `http://127.0.0.1:{port}`
5. When the window closes: shut down the uvicorn server and exit cleanly

**Key design decisions**:
- Reuse all existing server infrastructure (FastAPI app, handlers, watchdog)
- The only difference from CLI mode: native window instead of system browser
- Window title: "Markdown-OS — {filename_or_foldername}"
- Window size: 1200x800 default, resizable

---

## Step 3: Add pywebview Dependency

**File to modify**: `pyproject.toml`

- Add `pywebview>=5.0` to dependencies
- Add a new entry point: `markdown-os-desktop = "markdown_os.desktop:main"`

---

## Step 4: Create PyInstaller Spec

**File to create**: `markdown_os.spec` (PyInstaller spec file)

**Configuration**:
- Entry point: `markdown_os/desktop.py`
- Bundle: entire `markdown_os/static/` directory (including vendor assets)
- Bundle: `markdown_os/templates/` directory
- Hidden imports: fastapi, uvicorn, watchdog, etc.
- One-file mode for simpler distribution
- App name: "Markdown-OS"
- Icon: derive from existing `favicon.svg` (convert to .icns for macOS, .ico for Windows)

**File to create**: `scripts/build_desktop.py` — Build helper script that:
- Runs PyInstaller with the spec
- Handles macOS `.app` bundle and Windows `.exe` output

---

## Step 5: Tests

**File to create**: `tests/test_desktop.py`

- Test that the desktop module can create the FastAPI app correctly
- Test the server thread starts/stops cleanly
- Test file picker fallback logic
- Test argument parsing

---

## Summary of Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `scripts/download_vendor.py` | Script to download CDN assets |
| Create | `markdown_os/static/vendor/` | Bundled JS/CSS/font assets |
| Modify | `markdown_os/static/index.html` | Point to local vendor assets |
| Create | `markdown_os/desktop.py` | Desktop app entry point with pywebview |
| Modify | `pyproject.toml` | Add pywebview dep + desktop entry point |
| Create | `markdown_os.spec` | PyInstaller configuration |
| Create | `scripts/build_desktop.py` | Build helper script |
| Create | `tests/test_desktop.py` | Desktop module tests |

The existing CLI (`cli.py`), server, and all handlers remain **unchanged**.
