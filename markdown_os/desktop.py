"""Desktop application entry point using pywebview.

Launches the FastAPI/Uvicorn server in a background thread and opens
a native OS window via pywebview instead of the system browser.
"""

from __future__ import annotations

import sys
import threading
from pathlib import Path
from typing import TYPE_CHECKING

import uvicorn

from markdown_os.cli import find_available_port
from markdown_os.directory_handler import DirectoryHandler
from markdown_os.file_handler import FileHandler
from markdown_os.server import create_app

if TYPE_CHECKING:
    import webview

_WINDOW_WIDTH = 1200
_WINDOW_HEIGHT = 800


class DesktopApi:
    """Python-to-JS bridge exposed via pywebview's js_api.

    Methods on this class are callable from JavaScript as
    ``window.pywebview.api.<method_name>()``.
    """

    def __init__(self, window: webview.Window) -> None:
        self._window = window
        self._server_thread: threading.Thread | None = None
        self._server: uvicorn.Server | None = None

    # -- native file / folder dialogs --

    def open_file_dialog(self) -> str | None:
        """Show a native file-open dialog filtered to markdown files.

        Returns:
            First selected file path, or None if cancelled.
        """
        import webview as wv

        result = self._window.create_file_dialog(
            wv.OPEN_DIALOG,
            file_types=("Markdown Files (*.md *.markdown)",),
        )
        if result and len(result) > 0:
            return str(result[0])
        return None

    def open_folder_dialog(self) -> str | None:
        """Show a native folder-open dialog.

        Returns:
            Selected directory path, or None if cancelled.
        """
        import webview as wv

        result = self._window.create_file_dialog(wv.FOLDER_DIALOG)
        if result and len(result) > 0:
            return str(result[0])
        return None

    def open_path(self, path_str: str) -> dict:
        """Validate a path and start the editor server for it.

        Args:
            path_str: Absolute path to a markdown file or directory.

        Returns:
            Dict with ``url`` on success or ``error`` on failure.
        """
        path = Path(path_str).expanduser().resolve()

        if not path.exists():
            return {"error": f"Path does not exist: {path}"}

        if path.is_file():
            if path.suffix.lower() not in {".md", ".markdown"}:
                return {"error": "Only markdown files are supported (.md, .markdown)."}
            handler: FileHandler | DirectoryHandler = FileHandler(path)
            mode = "file"
            label = path.name
        elif path.is_dir():
            handler = DirectoryHandler(path)
            mode = "folder"
            label = path.name
        else:
            return {"error": f"Path is neither a file nor directory: {path}"}

        url = self._start_server(handler, mode)
        self._window.set_title(f"Markdown-OS \u2014 {label}")
        return {"url": url}

    def get_recent_paths(self) -> list[dict]:
        """Return recent paths from the persistent store.

        Recent paths are stored client-side in localStorage by welcome.js.
        This method is a no-op placeholder that the JS side manages.
        """
        return []

    # -- server lifecycle --

    def _start_server(
        self,
        handler: FileHandler | DirectoryHandler,
        mode: str,
    ) -> str:
        """Start uvicorn in a daemon thread and return the editor URL."""
        self._stop_server()

        application = create_app(handler, mode=mode, desktop=True)
        host = "127.0.0.1"
        port = find_available_port(host=host)
        url = f"http://{host}:{port}"

        config = uvicorn.Config(
            app=application,
            host=host,
            port=port,
            log_level="warning",
        )
        self._server = uvicorn.Server(config)

        self._server_thread = threading.Thread(
            target=self._server.run,
            daemon=True,
        )
        self._server_thread.start()

        # Wait for the server to be ready
        import time

        for _ in range(50):
            if self._server.started:
                break
            time.sleep(0.1)

        return url

    def _stop_server(self) -> None:
        """Signal the current uvicorn server to shut down."""
        if self._server is not None:
            self._server.should_exit = True
            if self._server_thread is not None:
                self._server_thread.join(timeout=3)
            self._server = None
            self._server_thread = None


def _resolve_initial_path(args: list[str]) -> Path | None:
    """Parse an optional file/folder path from CLI arguments.

    Returns None when no path is given (show welcome screen).
    """
    if len(args) < 2:
        return None
    candidate = Path(args[1]).expanduser().resolve()
    if candidate.exists():
        return candidate
    return None


def _require_webview():
    """Import and return the webview module, raising a clear error if missing."""
    try:
        import webview
    except ImportError:
        raise SystemExit(
            "pywebview is required for desktop mode.\n"
            "Install it with: pip install markdown-os[desktop]"
        ) from None
    return webview


def main() -> None:
    """Desktop application entry point."""
    wv = _require_webview()

    initial_path = _resolve_initial_path(sys.argv)

    # Create the window — start on the welcome page
    window = wv.create_window(
        title="Markdown-OS",
        url=None,
        width=_WINDOW_WIDTH,
        height=_WINDOW_HEIGHT,
        min_size=(600, 400),
    )

    api = DesktopApi(window)
    window.expose(api.open_file_dialog)
    window.expose(api.open_folder_dialog)
    window.expose(api.open_path)
    window.expose(api.get_recent_paths)

    def on_loaded():
        """Called once the webview window is ready."""
        if initial_path is not None:
            result = api.open_path(str(initial_path))
            if "url" in result:
                window.load_url(result["url"])
                return

        # No initial path or validation failed — show welcome page
        static_dir = Path(__file__).parent / "static"
        welcome_path = static_dir / "welcome.html"
        window.load_url(f"file://{welcome_path}")

    window.events.loaded += on_loaded

    wv.start(debug=False)

    # Cleanup server when window closes
    api._stop_server()


if __name__ == "__main__":
    main()
