"""FastAPI server for the Markdown-OS editor UI."""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Callable

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from markdown_os.file_handler import FileHandler, FileReadError, FileWriteError


class SaveRequest(BaseModel):
    """Body payload for save operations."""

    content: str


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


class MarkdownFileEventHandler(FileSystemEventHandler):
    """Watchdog handler that reacts only to the target markdown file."""

    def __init__(
        self,
        target_file: Path,
        notify_callback: Callable[[], None],
        should_ignore: Callable[[], bool],
    ) -> None:
        """
        Configure file watcher callbacks for a single markdown file.

        Args:
        - target_file (Path): Markdown file path that should trigger notifications.
        - notify_callback (Callable[[], None]): Callback invoked on external changes.
        - should_ignore (Callable[[], bool]): Callback returning True for ignored events.

        Returns:
        - None: Event handler is initialized with path checks and throttling state.
        """

        self._target_file = target_file.resolve()
        self._notify_callback = notify_callback
        self._should_ignore = should_ignore
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
        - None: Callback is invoked only for non-ignored target file events.
        """

        if event.is_directory:
            return

        event_path = getattr(event, "dest_path", event.src_path)
        if not self._is_target(event_path):
            return

        if self._should_ignore():
            return

        now = time.monotonic()
        if now - self._last_notified_at < 0.2:
            return

        self._last_notified_at = now
        self._notify_callback()

    def _is_target(self, event_path: str) -> bool:
        """
        Compare an event path against the configured markdown file.

        Args:
        - event_path (str): Raw path captured from a watchdog event.

        Returns:
        - bool: True when the event path resolves to the target file.
        """

        try:
            return Path(event_path).resolve() == self._target_file
        except OSError:
            return False


def create_app(file_handler: FileHandler) -> FastAPI:
    """
    Create the FastAPI application for the markdown editor.

    Args:
    - file_handler (FileHandler): File access service bound to one markdown file.

    Returns:
    - FastAPI: Configured application with routes, static assets, and websocket support.
    """

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

        def notify_external_change() -> None:
            """
            Schedule async websocket broadcast from watchdog threads.

            Args:
            - None (None): Thread callback uses application state only.

            Returns:
            - None: Broadcast coroutine is dispatched onto the running event loop.
            """

            loop.call_soon_threadsafe(
                lambda: asyncio.create_task(_broadcast_external_change(app))
            )

        event_handler = MarkdownFileEventHandler(
            target_file=app.state.file_handler.filepath,
            notify_callback=notify_external_change,
            should_ignore=lambda: _should_ignore_watcher_event(app),
        )

        observer.schedule(
            event_handler,
            path=str(app.state.file_handler.filepath.parent),
            recursive=False,
        )
        observer.start()

        try:
            yield
        finally:
            observer.stop()
            observer.join(timeout=3)

    app = FastAPI(title="Markdown-OS", lifespan=lifespan)
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    app.state.file_handler = file_handler
    app.state.websocket_hub = WebSocketHub()
    app.state.last_internal_write_at = 0.0

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

    @app.get("/api/content")
    async def get_content() -> dict[str, object]:
        """
        Return markdown content and metadata for the active file.

        Args:
        - None (None): Route handler reads from configured file handler.

        Returns:
        - dict[str, object]: Markdown content plus current file metadata.
        """

        try:
            content = app.state.file_handler.read()
            metadata = app.state.file_handler.get_metadata()
        except FileReadError as exc:
            raise HTTPException(
                status_code=_status_for_read_error(exc),
                detail=str(exc),
            ) from exc

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

        try:
            app.state.file_handler.write(payload.content)
            app.state.last_internal_write_at = time.monotonic()
            metadata = app.state.file_handler.get_metadata()
        except FileWriteError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        except FileReadError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        return {"status": "saved", "metadata": metadata}

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


def _should_ignore_watcher_event(app: FastAPI) -> bool:
    """
    Decide whether a watcher event should be ignored.

    Args:
    - app (FastAPI): Application state holder with last internal write timestamp.

    Returns:
    - bool: True when an event is likely caused by the app's own save request.
    """

    return (time.monotonic() - app.state.last_internal_write_at) < 0.5


async def _broadcast_external_change(app: FastAPI) -> None:
    """
    Broadcast external file updates to all connected websocket clients.

    Args:
    - app (FastAPI): Application state holder containing file and websocket services.

    Returns:
    - None: Sends a websocket message when fresh file content can be read.
    """

    try:
        content = app.state.file_handler.read()
    except FileReadError:
        return

    await app.state.websocket_hub.broadcast_json(
        {"type": "file_changed", "content": content}
    )


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
