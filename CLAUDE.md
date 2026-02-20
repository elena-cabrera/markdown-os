# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Markdown-OS is a developer-focused, CLI-driven markdown editor that runs as a local web server. It provides real-time editing with a read-first workflow, Mermaid diagram support, syntax highlighting, auto-saving, and light/dark theme switching.

**Tech Stack:**

-   Backend: Python 3.11+ with FastAPI, Typer CLI, Uvicorn ASGI server, Watchdog for file monitoring
-   Frontend: Vanilla HTML/CSS/JavaScript with Marked.js (markdown parsing), Mermaid.js (diagrams), highlight.js (syntax highlighting), svg-pan-zoom (interactive diagrams)

## Common Commands

### Development Setup

```bash
# Install dependencies (uses uv package manager)
uv sync

# Run the editor
uv run markdown-os open ./notes.md

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

### Running the Application

```bash
# Basic usage
uv run markdown-os open <filepath.md>

# Custom host and port
uv run markdown-os open <filepath.md> --host 0.0.0.0 --port 9000

# If port is occupied, the app auto-increments (8000 → 8001 → 8002...)

```

## Architecture Overview

### High-Level Flow

```text
CLI Command → Typer validates file → FastAPI server starts → Browser opens
                                         ↓
User edits in browser → WebSocket connection → Server saves to disk
                                         ↓
External file change → Watchdog detects → WebSocket notifies browser

```

### Key Components

#### 1\. CLI Layer (`markdown_os/cli.py`)

-   Entry point: `markdown-os` command defined in `pyproject.toml`
-   Validates markdown file paths (.md, .markdown extensions only)
-   Implements port auto-increment logic (tries 8000-65535)
-   Opens browser automatically after 0.4s delay
-   Creates FileHandler and FastAPI app, then runs uvicorn server

#### 2\. FastAPI Server (`markdown_os/server.py`)

-   **Routes:**
    -   `GET /`: Serves the editor HTML page
    -   `GET /api/content`: Returns markdown content and metadata
    -   `POST /api/save`: Saves content atomically to disk
    -   `WebSocket /ws`: Real-time notifications for external file changes
-   **WebSocketHub**: Manages active websocket clients and broadcasts messages
-   **MarkdownFileEventHandler**: Watchdog event handler that filters events for the target file and throttles notifications (0.2s minimum interval)
-   **Lifespan management**: Starts/stops filesystem observer with the app

#### 3\. File Handler (`markdown_os/file_handler.py`)

-   Implements safe file I/O with POSIX file locks (fcntl)
-   **Read operations**: Use shared locks (LOCK\_SH) for concurrent reads
-   **Write operations**: Use exclusive locks (LOCK\_EX) with atomic file replacement
    -   Write to temporary file with fsync
    -   Replace original file with os.replace() (atomic on POSIX)
    -   Uses .lock files in same directory as markdown file
-   **Error handling**: Custom FileReadError and FileWriteError exceptions

#### 4\. Frontend (`markdown_os/static/`)

-   **index.html**: Main editor page with tabbed interface (Edit/Preview modes)
-   **js/editor.js**: Content loading, tab switching, conflict handling, auto-save with 1s debouncing
-   **js/markdown.js**: Markdown rendering with Marked.js, Mermaid diagram rendering, syntax highlighting, code block enhancements (copy button, language labels)
-   **js/theme.js**: Theme preference management, system preference detection, highlight theme switching, Mermaid re-render trigger
-   **js/toc.js**: Auto-generated table of contents from headings with smooth scrolling
-   **js/websocket.js**: WebSocket connection for external file change notifications
-   **css/styles.css**: Layout and styling

### Critical Implementation Details

#### File Locking Strategy

-   Lock files are created at `<filename>.md.lock` next to the markdown file
-   Shared locks (LOCK\_SH) allow multiple concurrent readers
-   Exclusive locks (LOCK\_EX) ensure only one writer at a time
-   Locks are always released in finally blocks

#### External Change Detection

-   Watchdog monitors the markdown file's parent directory (non-recursive)
-   Events are filtered to match only the target file path
-   Events within 0.5s of internal writes are ignored to prevent self-notification
-   Events are throttled to max one notification per 0.2s
-   Browser receives `{"type": "file_changed", "content": "<new content>"}` via WebSocket

#### Auto-save and Mode Behavior

-   Files open in `Preview` mode by default (`read-first` behavior).
-   `Edit` mode is active only when the Edit tab is selected.
-   Editor input triggers debounced save after 1 second of inactivity
-   Preview renders on demand when Preview tab is active (not on every edit keystroke)
-   Save status indicator shows "Saving...", "Saved", or error states
-   Switching `Edit → Preview` auto-saves unless a conflict is detected
-   Conflict detection compares `/api/content` against `lastSavedContent`; if different and there are unsaved edits, a 3-button modal is shown (`Save My Changes`, `Discard My Changes`, `Cancel`)
-   Server timestamps internal writes to distinguish from external changes

#### Theme Behavior

-   Theme defaults to system preference (`prefers-color-scheme`) when no manual choice exists
-   Manual theme toggles are persisted in `localStorage` key `markdown-os-theme`
-   Syntax highlighting switches between `github` and `github-dark` highlight.js stylesheets
-   Mermaid diagrams are re-rendered on theme changes using source stored in `data-original-content`

## Testing Conventions

-   Tests use pytest with async support (pytest-asyncio)
-   Test files mirror source structure: `tests/test_<module>.py`
-   Use pytest fixtures: `tmp_path` for temporary directories, httpx.AsyncClient for API testing
-   Test both success paths and error conditions (missing files, invalid permissions, etc.)
-   Server tests create test apps with temporary file handlers

## Code Style and Patterns

-   Type hints are used throughout (PEP 484)
-   Docstrings follow Google-style format with Args/Returns sections
-   All public functions/methods have docstrings
-   Error handling uses custom exceptions (FileReadError, FileWriteError)
-   Async/await is used consistently in FastAPI routes
-   Context managers are used for resource management (locks, files)

## Important Notes

-   The app only supports one markdown file at a time (MVP constraint)
-   Port 8000 is preferred but auto-increments if occupied
-   Browser opens automatically 0.4s after server start
-   File locks use POSIX fcntl (may not work on Windows without adaptation)
-   WebSocket reconnection logic is handled client-side
-   Static files are served from `markdown_os/static/` directory
-   The CLI script is exposed via `pyproject.toml` entry points