# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Markdown-OS is a developer-focused, CLI-driven markdown editor that runs as a local web server. It features a WYSIWYG editor with real-time markdown rendering, supports both single-file and directory/workspace modes, Mermaid diagrams, KaTeX math, syntax highlighting, image uploads, multi-file tabs, and multiple themes.

**Tech Stack:**

-   Backend: Python 3.11+ with FastAPI, Typer CLI, Uvicorn ASGI server, Watchdog for file monitoring
-   Frontend: Vanilla HTML/CSS/JavaScript with Marked.js (markdown parsing), Turndown.js (HTML-to-markdown serialization), Mermaid.js (diagrams), KaTeX (math equations), highlight.js (syntax highlighting), svg-pan-zoom (interactive diagrams)

## Common Commands

```bash
# Install dependencies (uses uv package manager)
uv sync

# Run the editor on a single file
uv run markdown-os open ./notes.md

# Run the editor on a directory (folder mode)
uv run markdown-os open ./my-docs/

# Run with no argument (opens current directory)
uv run markdown-os

# Custom host and port
uv run markdown-os open <path> --host 0.0.0.0 --port 9000

# Generate a feature showcase markdown file
uv run markdown-os example

# Generate showcase and open it immediately
uv run markdown-os example --open

# Run all tests
uv run pytest

# Run specific test file
uv run pytest tests/test_cli.py

# Run single test
uv run pytest tests/test_cli.py::test_validate_markdown_file_returns_resolved_path

# Run tests with verbose output
uv run pytest -v

# Run tests with output capture disabled (see print statements)
uv run pytest -s
```

## Architecture Overview

### High-Level Flow

```text
CLI Command → Typer validates file/directory → FastAPI server starts → Browser opens
                                                      ↓
User edits in WYSIWYG editor → WebSocket connection → Server saves to disk
                                                      ↓
External file change → Watchdog detects → WebSocket notifies browser
```

### Two Operating Modes

The app operates in either **file mode** (single markdown file) or **folder mode** (directory workspace):

-   **File mode**: `markdown-os open notes.md` — opens one file, no sidebar or tabs
-   **Folder mode**: `markdown-os open ./docs/` — shows file tree sidebar, supports multi-file tabs (up to 15), URL-based file routing via `?file=path/to/file.md`

The mode is determined at CLI validation time (`_validate_path` in `cli.py`) and passed through to `create_app(handler, mode)`.

### Key Components

#### 1. CLI Layer (`markdown_os/cli.py`)

-   Entry point: `markdown-os` command defined in `pyproject.toml` → `markdown_os.cli:run`
-   `_validate_path()` determines mode: returns `(resolved_path, "file")` or `(resolved_path, "folder")`
-   Implements port auto-increment logic (tries 8000-65535)
-   Opens browser automatically after 0.4s delay
-   `example` subcommand generates a feature showcase file from bundled template

#### 2. FastAPI Server (`markdown_os/server.py`)

-   `create_app(handler, mode)` factory — accepts either `FileHandler` or `DirectoryHandler`
-   **Routes:**
    -   `GET /` — Serves the editor HTML page
    -   `GET /api/mode` — Returns `"file"` or `"folder"`
    -   `GET /api/file-tree` — Returns nested folder/file tree (folder mode only)
    -   `GET /api/content?file=<path>` — Returns markdown content and metadata
    -   `POST /api/save` — Saves content atomically; accepts optional `file` field for folder mode
    -   `POST /api/images` — Upload images (PNG/JPG/GIF/WEBP/SVG/BMP/ICO, max 10MB)
    -   `GET /images/{filename}` — Serve uploaded images from workspace `images/` directory
    -   `WebSocket /ws` — Real-time notifications for external file changes
-   **WebSocketHub**: Manages active websocket clients and broadcasts messages
-   **MarkdownPathEventHandler**: Watchdog handler supporting both single-file and recursive directory watching; throttles to max one notification per 0.2s, ignores events within 0.5s of internal writes

#### 3. File Handlers

-   **`FileHandler`** (`markdown_os/file_handler.py`): Safe file I/O with POSIX file locks (fcntl). Shared locks (LOCK_SH) for reads, exclusive locks (LOCK_EX) with atomic replacement (write to temp file → fsync → `os.replace()`) for writes. Lock files at `<filename>.md.lock`.
-   **`DirectoryHandler`** (`markdown_os/directory_handler.py`): Manages a directory of markdown files. Builds nested file trees, caches `FileHandler` instances per file, validates paths stay within the workspace root (prevents directory traversal).

#### 4. Frontend (`markdown_os/static/`)

The frontend is a vanilla JS SPA with no build step. All modules use IIFEs exposing methods on `window.MarkdownOS`.

-   **`js/wysiwyg.js`** (~2000 lines) — Core WYSIWYG editor using `contenteditable` with Marked.js for rendering and Turndown.js for serialization. Handles inline markdown shortcuts (e.g., `**text** ` → bold, `# ` → heading), click-to-edit blocks (code, mermaid, math), interactive links (Cmd/Ctrl+Click to open, click to edit), image paste/drop, undo/redo history.
-   **`js/wysiwyg-toolbar.js`** — Floating formatting toolbar with bold/italic/strikethrough/code/link buttons, heading selector, list toggles, and insert menu (table, image, horizontal rule, mermaid diagram).
-   **`js/editor.js`** — Orchestrator that initializes the WYSIWYG editor, manages auto-save (1s debounce), conflict detection, file loading, and coordinates between tabs/file-tree/websocket modules.
-   **`js/tabs.js`** — Multi-file tab bar for folder mode. Tracks dirty state, caches content and scroll positions per tab, smart tab naming when basenames conflict.
-   **`js/file-tree.js`** — Sidebar file tree with search, collapsible folders, active file highlighting.
-   **`js/theme.js`** — Theme manager with 6 themes (Default Light, Default Dark, Dracula, Nord Light, Nord Dark, Lofi). Dropdown UI with color dot swatches. Coordinates highlight.js stylesheet and Mermaid theme per app theme.
-   **`js/markdown.js`** — Markdown rendering pipeline: Marked.js extensions for math (KaTeX) and mermaid, syntax highlighting, code block enhancements (copy button, language labels, line numbers).
-   **`js/dialogs.js`** — Custom modal dialogs: `confirm()`, `prompt()`, `promptPair()` with keyboard navigation.
-   **`js/toc.js`** — Auto-generated table of contents from headings with smooth scrolling.
-   **`js/websocket.js`** — WebSocket connection with reconnection logic for external file change notifications.
-   **`css/styles.css`** — Layout and component styling.
-   **`css/themes.css`** — CSS custom properties for all 6 themes.

### Critical Implementation Details

#### WYSIWYG Editing Model

The editor uses `contenteditable` on a container div. Content flows through this pipeline:
1. **Load**: Server markdown → `marked.parse()` → rendered HTML in contenteditable
2. **Save**: contenteditable HTML → `TurndownService` → markdown string → `POST /api/save`
3. **Inline shortcuts**: Detected on `input`/`keydown` events, transform text as the user types
4. **Block editing**: Code blocks, mermaid diagrams, and math equations use click-to-edit modals that operate on the raw source stored in `data-original-content` attributes

#### Auto-save, Conflict Detection, and File Sync

-   Editor input triggers debounced save after 1 second of inactivity
-   Save status indicator shows "Saving...", "Saved", or error states
-   Conflict detection compares `/api/content` against `lastSavedContent`; if different and there are unsaved edits, a 3-button modal is shown (Save My Changes / Discard My Changes / Cancel)
-   Server timestamps internal writes to distinguish from external changes
-   In folder mode, WebSocket messages include a `file` field so clients know which file changed

#### Image Upload

-   Images can be pasted (Ctrl+V) or dragged into the editor
-   Uploaded via `POST /api/images` multipart form
-   Saved to `images/` directory adjacent to the markdown file (file mode) or workspace root (folder mode)
-   Filenames are sanitized with timestamp suffix to prevent collisions

## Testing Conventions

-   Tests use pytest with async support (pytest-asyncio)
-   Test files mirror source structure: `tests/test_<module>.py`
-   Use pytest fixtures: `tmp_path` for temporary directories, `httpx.AsyncClient` for API testing
-   Test both success paths and error conditions
-   Server tests create test apps with temporary file handlers
-   `test_frontend_navigation_sync.py` tests multi-file tab and URL routing behavior

## Code Style and Patterns

-   Type hints throughout (PEP 484)
-   Google-style docstrings with Args/Returns sections on all public functions
-   Custom exceptions: `FileReadError`, `FileWriteError`
-   Async/await in all FastAPI routes
-   Frontend modules use IIFEs exposing public API on `window.MarkdownOS`

## Important Notes

-   Port 8000 is preferred but auto-increments if occupied
-   File locks use POSIX fcntl (not Windows-compatible without adaptation)
-   Static files served from `markdown_os/static/` — no build step required
-   The CLI script entry point is `markdown_os.cli:run` via `pyproject.toml`
-   With no subcommand, `markdown-os` opens the current working directory in folder mode
