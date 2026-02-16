"""FastAPI server for the Markdown-OS editor UI."""

from __future__ import annotations

import asyncio
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from fastapi import FastAPI, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from markdown_os.directory_handler import DirectoryHandler
from markdown_os.file_handler import FileHandler, FileReadError, FileWriteError

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"}
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024


class SaveRequest(BaseModel):
    """Body payload for save operations."""

    content: str
    file: str | None = None


class WebSocketHub:
    """Manage active websocket clients and fan-out messages."""

    def __init__(self) -> None:
        """
        Initialize websocket storage for connected clients.

        Args:
        - None (None): This initializer does not require parameters.

        Returns:
        - None: A hub instance with empty client registry is created.
        """

        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """
        Accept and register a new websocket client.

        Args:
        - websocket (WebSocket): FastAPI websocket connection to accept.

        Returns:
        - None: The client is stored for future broadcast calls.
        """

        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        """
        Remove a websocket client from the active set.

        Args:
        - websocket (WebSocket): FastAPI websocket connection to remove.

        Returns:
        - None: The websocket client is removed if present.
        """

        async with self._lock:
            self._clients.discard(websocket)

    async def broadcast_json(self, payload: dict[str, str]) -> None:
        """
        Send a JSON payload to all currently connected websocket clients.

        Args:
        - payload (dict[str, str]): Serializable message payload sent to clients.

        Returns:
        - None: Payload is delivered to each active client when possible.
        """

        async with self._lock:
            clients = list(self._clients)

        stale_clients: list[WebSocket] = []
        for client in clients:
            try:
                await client.send_json(payload)
            except RuntimeError:
                stale_clients.append(client)

        if stale_clients:
            async with self._lock:
                for stale_client in stale_clients:
                    self._clients.discard(stale_client)


class MarkdownPathEventHandler(FileSystemEventHandler):
    """Watchdog handler for markdown file changes in file or folder mode."""

    def __init__(
        self,
        notify_callback: Callable[[Path], None],
        should_ignore: Callable[[], bool],
        target_file: Path | None = None,
        root_directory: Path | None = None,
    ) -> None:
        """
        Configure file watcher callbacks for markdown updates.

        Args:
        - notify_callback (Callable[[Path], None]): Callback invoked on external changes.
        - should_ignore (Callable[[], bool]): Callback returning True for ignored events.
        - target_file (Path | None): Single-file mode target markdown path.
        - root_directory (Path | None): Folder-mode workspace root path.

        Returns:
        - None: Event handler is initialized with path checks and throttling state.
        """

        self._notify_callback = notify_callback
        self._should_ignore = should_ignore
        self._target_file = target_file.resolve() if target_file is not None else None
        self._root_directory = (
            root_directory.resolve() if root_directory is not None else None
        )
        self._last_notified_at = 0.0
        super().__init__()

    def on_modified(self, event: FileSystemEvent) -> None:
        """
        Process file modified events from watchdog.

        Args:
        - event (FileSystemEvent): Event emitted by watchdog observer.

        Returns:
        - None: Relevant events trigger the configured notification callback.
        """

        self._handle_event(event)

    def on_moved(self, event: FileSystemEvent) -> None:
        """
        Process file moved events from watchdog.

        Args:
        - event (FileSystemEvent): Event emitted by watchdog observer.

        Returns:
        - None: Relevant events trigger the configured notification callback.
        """

        self._handle_event(event)

    def on_created(self, event: FileSystemEvent) -> None:
        """
        Process file created events from watchdog.

        Args:
        - event (FileSystemEvent): Event emitted by watchdog observer.

        Returns:
        - None: Relevant events trigger the configured notification callback.
        """

        self._handle_event(event)

    def _handle_event(self, event: FileSystemEvent) -> None:
        """
        Filter and throttle watcher events before notifying clients.

        Args:
        - event (FileSystemEvent): Raw watchdog event to inspect.

        Returns:
        - None: Callback is invoked only for non-ignored markdown file events.
        """

        if event.is_directory:
            return

        event_path_value = getattr(event, "dest_path", None) or event.src_path
        try:
            resolved_event_path = Path(event_path_value).resolve()
        except OSError:
            return

        if not self._is_relevant_path(resolved_event_path):
            return
        if self._should_ignore():
            return

        now = time.monotonic()
        if now - self._last_notified_at < 0.2:
            return

        self._last_notified_at = now
        self._notify_callback(resolved_event_path)

    def _is_relevant_path(self, event_path: Path) -> bool:
        """
        Determine whether an event path should trigger notifications.

        Args:
        - event_path (Path): Resolved event path captured from watchdog.

        Returns:
        - bool: True when the path is a watched markdown file.
        """

        if self._target_file is not None:
            return event_path == self._target_file

        if self._root_directory is None:
            return False

        if not event_path.is_relative_to(self._root_directory):
            return False

        return event_path.suffix.lower() in {".md", ".markdown"}


def create_app(handler: FileHandler | DirectoryHandler, mode: str = "file") -> FastAPI:
    """
    Create the FastAPI application for the markdown editor.

    Args:
    - handler (FileHandler | DirectoryHandler): File or folder access service.
    - mode (str): Editor mode, either "file" or "folder".

    Returns:
    - FastAPI: Configured application with routes, static assets, and websocket support.
    """

    if mode not in {"file", "folder"}:
        raise ValueError("mode must be either 'file' or 'folder'.")

    static_dir = Path(__file__).parent / "static"

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """
        Start and stop filesystem observers around app lifecycle.

        Args:
        - app (FastAPI): FastAPI application instance entering lifespan context.

        Returns:
        - None: Context manager yields control while observer is running.
        """

        observer = Observer()
        loop = asyncio.get_running_loop()

        def notify_external_change(changed_path: Path) -> None:
            """
            Schedule async websocket broadcast from watchdog threads.

            Args:
            - changed_path (Path): Changed markdown file path captured by watchdog.

            Returns:
            - None: Broadcast coroutine is dispatched onto the running event loop.
            """

            loop.call_soon_threadsafe(
                lambda: asyncio.create_task(
                    _broadcast_external_change(app, changed_path)
                )
            )

        if app.state.mode == "file":
            file_handler = _require_file_handler(app)
            event_handler = MarkdownPathEventHandler(
                target_file=file_handler.filepath,
                notify_callback=notify_external_change,
                should_ignore=lambda: _should_ignore_watcher_event(app),
            )
            watch_path = str(file_handler.filepath.parent)
            recursive = False
        else:
            directory_handler = _require_directory_handler(app)
            event_handler = MarkdownPathEventHandler(
                root_directory=directory_handler.directory,
                notify_callback=notify_external_change,
                should_ignore=lambda: _should_ignore_watcher_event(app),
            )
            watch_path = str(directory_handler.directory)
            recursive = True

        observer.schedule(
            event_handler,
            path=watch_path,
            recursive=recursive,
        )
        observer.start()

        try:
            yield
        finally:
            observer.stop()
            observer.join(timeout=3)

    app = FastAPI(title="Markdown-OS", lifespan=lifespan)
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    app.state.handler = handler
    app.state.mode = mode
    app.state.current_file = None
    app.state.websocket_hub = WebSocketHub()
    app.state.last_internal_write_at = 0.0

    @app.get("/favicon.ico")
    async def favicon() -> RedirectResponse:
        """Redirect browser default favicon.ico requests to the SVG favicon."""
        return RedirectResponse(url="/static/favicon.svg", status_code=302)

    @app.get("/")
    async def read_root() -> FileResponse:
        """
        Serve the editor web page.

        Args:
        - None (None): Route handler serves a static HTML file.

        Returns:
        - FileResponse: The main editor application HTML response.
        """

        return FileResponse(static_dir / "index.html")

    @app.get("/api/mode")
    async def get_mode() -> dict[str, str]:
        """
        Return the current server mode.

        Args:
        - None (None): Route reads mode from app state.

        Returns:
        - dict[str, str]: Mode payload with value "file" or "folder".
        """

        return {"mode": app.state.mode}

    @app.get("/api/file-tree")
    async def get_file_tree() -> dict[str, Any]:
        """
        Return the markdown file tree for folder mode.

        Args:
        - None (None): Route reads tree from directory handler.

        Returns:
        - dict[str, Any]: Nested folder/file structure.
        """

        if app.state.mode != "folder":
            raise HTTPException(
                status_code=400,
                detail="File tree is only available in folder mode.",
            )

        directory_handler = _require_directory_handler(app)
        return directory_handler.get_file_tree()

    @app.get("/api/content")
    async def get_content(file: str | None = None) -> dict[str, object]:
        """
        Return markdown content and metadata.

        Args:
        - file (str | None): Relative file path in folder mode.

        Returns:
        - dict[str, object]: Markdown content plus current file metadata.
        """

        if app.state.mode == "file":
            file_handler = _require_file_handler(app)
            try:
                content = file_handler.read()
                metadata = file_handler.get_metadata()
            except FileReadError as exc:
                raise HTTPException(
                    status_code=_status_for_read_error(exc),
                    detail=str(exc),
                ) from exc

            return {"content": content, "metadata": metadata}

        if not file:
            raise HTTPException(status_code=400, detail="Missing 'file' query parameter.")

        directory_handler = _require_directory_handler(app)
        if not directory_handler.validate_file_path(file):
            raise HTTPException(status_code=400, detail=f"Invalid file path: {file}")

        try:
            file_handler = directory_handler.get_file_handler(file)
            content = file_handler.read()
            metadata = file_handler.get_metadata()
            relative_path = file_handler.filepath.relative_to(
                directory_handler.directory
            ).as_posix()
            metadata["relative_path"] = relative_path
        except FileReadError as exc:
            raise HTTPException(
                status_code=_status_for_read_error(exc),
                detail=str(exc),
            ) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        app.state.current_file = relative_path
        return {"content": content, "metadata": metadata}

    @app.post("/api/save")
    async def save_content(payload: SaveRequest) -> dict[str, object]:
        """
        Persist markdown content to disk with atomic file replacement.

        Args:
        - payload (SaveRequest): Request body containing markdown content.

        Returns:
        - dict[str, object]: Save confirmation and updated file metadata.
        """

        if app.state.mode == "file":
            file_handler = _require_file_handler(app)
            try:
                file_handler.write(payload.content)
                app.state.last_internal_write_at = time.monotonic()
                metadata = file_handler.get_metadata()
            except FileWriteError as exc:
                raise HTTPException(status_code=500, detail=str(exc)) from exc
            except FileReadError as exc:
                raise HTTPException(status_code=500, detail=str(exc)) from exc

            return {"status": "saved", "metadata": metadata}

        file_path = payload.file
        if not file_path:
            raise HTTPException(status_code=400, detail="Missing 'file' in request body.")

        directory_handler = _require_directory_handler(app)
        if not directory_handler.validate_file_path(file_path):
            raise HTTPException(status_code=400, detail=f"Invalid file path: {file_path}")

        try:
            file_handler = directory_handler.get_file_handler(file_path)
            file_handler.write(payload.content)
            app.state.last_internal_write_at = time.monotonic()
            metadata = file_handler.get_metadata()
            relative_path = file_handler.filepath.relative_to(
                directory_handler.directory
            ).as_posix()
            metadata["relative_path"] = relative_path
            app.state.current_file = relative_path
        except FileWriteError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        except FileReadError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {"status": "saved", "metadata": metadata}

    @app.post("/api/images")
    async def upload_image(file: UploadFile) -> dict[str, str]:
        """
        Save an uploaded image in the workspace images directory.

        Args:
        - file (UploadFile): Uploaded image data from multipart form payload.

        Returns:
        - dict[str, str]: Relative image path and saved filename.
        """

        original_name = file.filename or "image.png"
        suffix = Path(original_name).suffix.lower()
        if suffix not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image format: {suffix or '(missing extension)'}",
            )

        image_data = await file.read()
        if not image_data:
            raise HTTPException(status_code=400, detail="Empty file uploaded.")
        if len(image_data) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Image too large. Maximum size is "
                    f"{MAX_IMAGE_SIZE_BYTES // (1024 * 1024)} MB."
                ),
            )

        safe_stem = re.sub(r"[^a-zA-Z0-9_-]", "-", Path(original_name).stem).strip("-")
        if not safe_stem:
            safe_stem = "image"

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        filename = f"{safe_stem}-{timestamp}{suffix}"

        images_dir = _get_images_dir(app)
        images_dir.mkdir(parents=True, exist_ok=True)
        destination = images_dir / filename
        destination.write_bytes(image_data)

        return {"path": f"images/{filename}", "filename": filename}

    @app.get("/images/{filename:path}")
    async def serve_image(filename: str) -> FileResponse:
        """
        Serve uploaded images from the workspace images directory.

        Args:
        - filename (str): Relative filename under the images directory.

        Returns:
        - FileResponse: Streamed image file response when present.
        """

        if ".." in filename or filename.startswith("/"):
            raise HTTPException(status_code=400, detail="Invalid image path.")

        images_dir = _get_images_dir(app)
        image_path = (images_dir / filename).resolve()
        images_root = images_dir.resolve()
        if not image_path.is_relative_to(images_root):
            raise HTTPException(status_code=400, detail="Invalid image path.")
        if not image_path.is_file():
            raise HTTPException(status_code=404, detail="Image not found.")

        return FileResponse(image_path)

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        """
        Maintain websocket connections for external file-change notifications.

        Args:
        - websocket (WebSocket): Incoming websocket connection from the browser.

        Returns:
        - None: Connection stays open until the client disconnects.
        """

        await app.state.websocket_hub.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            await app.state.websocket_hub.disconnect(websocket)
        except RuntimeError:
            await app.state.websocket_hub.disconnect(websocket)

    return app


def _require_file_handler(app: FastAPI) -> FileHandler:
    """
    Ensure app state has a FileHandler in single-file mode.

    Args:
    - app (FastAPI): Application state container.

    Returns:
    - FileHandler: Valid file handler from app state.
    """

    handler = app.state.handler
    if not isinstance(handler, FileHandler):
        raise RuntimeError("Invalid handler type for file mode.")
    return handler


def _require_directory_handler(app: FastAPI) -> DirectoryHandler:
    """
    Ensure app state has a DirectoryHandler in folder mode.

    Args:
    - app (FastAPI): Application state container.

    Returns:
    - DirectoryHandler: Valid directory handler from app state.
    """

    handler = app.state.handler
    if not isinstance(handler, DirectoryHandler):
        raise RuntimeError("Invalid handler type for folder mode.")
    return handler


def _should_ignore_watcher_event(app: FastAPI) -> bool:
    """
    Decide whether a watcher event should be ignored.

    Args:
    - app (FastAPI): Application state holder with last internal write timestamp.

    Returns:
    - bool: True when an event is likely caused by the app's own save request.
    """

    return (time.monotonic() - app.state.last_internal_write_at) < 0.5


def _get_images_dir(app: FastAPI) -> Path:
    """
    Resolve the images directory for the current application mode.

    Args:
    - app (FastAPI): Application state holder with mode and handlers.

    Returns:
    - Path: Absolute path to the workspace-level images directory.
    """

    if app.state.mode == "file":
        file_handler = _require_file_handler(app)
        return file_handler.filepath.parent / "images"

    directory_handler = _require_directory_handler(app)
    return directory_handler.directory / "images"


async def _broadcast_external_change(app: FastAPI, changed_path: Path) -> None:
    """
    Broadcast external file updates to all connected websocket clients.

    Args:
    - app (FastAPI): Application state holder containing file and websocket services.
    - changed_path (Path): Markdown path reported by watchdog.

    Returns:
    - None: Sends a websocket message when fresh file content can be read.
    """

    if app.state.mode == "file":
        file_handler = _require_file_handler(app)
        try:
            content = file_handler.read()
        except FileReadError:
            return

        await app.state.websocket_hub.broadcast_json(
            {"type": "file_changed", "content": content}
        )
        return

    directory_handler = _require_directory_handler(app)
    try:
        relative_path = changed_path.relative_to(directory_handler.directory).as_posix()
    except ValueError:
        return

    payload: dict[str, str] = {"type": "file_changed", "file": relative_path}
    if directory_handler.validate_file_path(relative_path):
        try:
            file_handler = directory_handler.get_file_handler(relative_path)
            payload["content"] = file_handler.read()
        except (FileReadError, FileNotFoundError, ValueError):
            pass

    await app.state.websocket_hub.broadcast_json(payload)


def _status_for_read_error(error: FileReadError) -> int:
    """
    Map read errors to an HTTP status code.

    Args:
    - error (FileReadError): Domain-specific read exception raised by file handler.

    Returns:
    - int: HTTP status code representing the read failure category.
    """

    if "does not exist" in str(error):
        return 404
    return 500
