"""Dynamic workspace session management for desktop-mode runtime."""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import TYPE_CHECKING, Callable

from fastapi import FastAPI
from watchdog.observers import Observer

from markdown_os.app_runtime import build_handler_for_target, resolve_target_path
from markdown_os.directory_handler import DirectoryHandler
from markdown_os.file_handler import FileHandler

if TYPE_CHECKING:
    from markdown_os.server import MarkdownPathEventHandler


class WorkspaceSession:
    """Manage the active workspace handler and file watcher lifecycle."""

    def __init__(
        self,
        app: FastAPI,
        notify_callback: Callable[[Path], None],
        event_handler_factory: Callable[..., "MarkdownPathEventHandler"],
    ) -> None:
        """
        Initialize mutable runtime state for a desktop workspace session.

        Args:
        - app (FastAPI): Application instance that owns this session state.
        - notify_callback (Callable[[Path], None]): Callback used for watcher events.
        - event_handler_factory (Callable[..., MarkdownPathEventHandler]): Factory used to create watcher handlers.

        Returns:
        - None: Session starts in empty mode with no handler or observer.
        """

        self._app = app
        self._notify_callback = notify_callback
        self._event_handler_factory = event_handler_factory
        self._state_lock = asyncio.Lock()
        self._observer: Observer | None = None
        self._mode = "empty"
        self._handler: FileHandler | DirectoryHandler | None = None
        self._workspace_path: Path | None = None
        self._current_file: str | None = None
        self._is_empty_workspace = False
        self._last_internal_write_at = 0.0
        self._sync_app_state()

    @property
    def mode(self) -> str:
        """
        Return the current workspace mode.

        Args:
        - None (None): This property reads session state only.

        Returns:
        - str: One of ``empty``, ``file``, or ``folder``.
        """

        return self._mode

    @property
    def handler(self) -> FileHandler | DirectoryHandler | None:
        """
        Return the active workspace handler.

        Args:
        - None (None): This property reads session state only.

        Returns:
        - FileHandler | DirectoryHandler | None: Active handler or ``None`` in empty mode.
        """

        return self._handler

    @property
    def current_file(self) -> str | None:
        """
        Return the current file for folder-mode navigation.

        Args:
        - None (None): This property reads session state only.

        Returns:
        - str | None: Relative current file path or ``None``.
        """

        return self._current_file

    @property
    def workspace_path(self) -> Path | None:
        """
        Return the active workspace path.

        Args:
        - None (None): This property reads session state only.

        Returns:
        - Path | None: Active file or directory path, or ``None`` when empty.
        """

        return self._workspace_path

    @property
    def is_empty_workspace(self) -> bool:
        """
        Return whether the current folder workspace has no markdown files.

        Args:
        - None (None): This property reads session state only.

        Returns:
        - bool: True when folder mode has zero markdown files.
        """

        return self._is_empty_workspace

    async def open_path(self, path: Path) -> dict[str, object]:
        """
        Resolve and open a file or directory workspace.

        Args:
        - path (Path): User-selected file or directory path.

        Returns:
        - dict[str, object]: Snapshot of the new workspace state after opening.
        """

        resolved_path, mode = resolve_target_path(path)
        if mode == "file":
            return await self.open_file(resolved_path)
        return await self.open_folder(resolved_path)

    async def initialize(
        self,
        *,
        mode: str,
        handler: FileHandler | DirectoryHandler | None,
    ) -> dict[str, object]:
        """
        Initialize the session from a pre-built handler during app startup.

        Args:
        - mode (str): Initial runtime mode (`"empty"`, `"file"`, or `"folder"`).
        - handler (FileHandler | DirectoryHandler | None): Pre-built handler for the initial mode.

        Returns:
        - dict[str, object]: Snapshot describing the initialized session state.
        """

        async with self._state_lock:
            await self._close_unlocked()
            if mode == "empty" or handler is None:
                self._sync_app_state()
                return self.snapshot()

            self._handler = handler
            self._mode = mode
            if mode == "file":
                assert isinstance(handler, FileHandler)
                self._workspace_path = handler.filepath
                self._is_empty_workspace = False
            elif mode == "folder":
                assert isinstance(handler, DirectoryHandler)
                self._workspace_path = handler.directory
                self._is_empty_workspace = len(handler.list_files()) == 0
            else:
                raise ValueError("mode must be one of 'empty', 'file', or 'folder'.")

            self._current_file = None
            self._restart_observer_unlocked()
            self._sync_app_state()
            return self.snapshot()

    async def open_file(self, path: Path) -> dict[str, object]:
        """
        Open a markdown file as the active session target.

        Args:
        - path (Path): Absolute or relative markdown file path.

        Returns:
        - dict[str, object]: Snapshot describing the resulting file-mode state.
        """

        resolved_path, mode = resolve_target_path(path)
        if mode != "file":
            raise ValueError("Path must resolve to a markdown file.")

        async with self._state_lock:
            await self._close_unlocked()
            handler = build_handler_for_target(resolved_path, mode)
            self._handler = handler
            self._mode = "file"
            self._workspace_path = resolved_path
            self._current_file = None
            self._is_empty_workspace = False
            self._restart_observer_unlocked()
            self._sync_app_state()
            return self.snapshot()

    async def open_folder(self, path: Path) -> dict[str, object]:
        """
        Open a directory workspace as the active session target.

        Args:
        - path (Path): Absolute or relative directory path.

        Returns:
        - dict[str, object]: Snapshot describing the resulting folder-mode state.
        """

        resolved_path, mode = resolve_target_path(path)
        if mode != "folder":
            raise ValueError("Path must resolve to a directory.")

        async with self._state_lock:
            await self._close_unlocked()
            handler = build_handler_for_target(resolved_path, mode)
            self._handler = handler
            self._mode = "folder"
            self._workspace_path = resolved_path
            self._current_file = None
            self._is_empty_workspace = len(handler.list_files()) == 0
            self._restart_observer_unlocked()
            self._sync_app_state()
            return self.snapshot()

    async def close_workspace(self) -> dict[str, object]:
        """
        Close the active workspace and return to empty mode.

        Args:
        - None (None): This method closes the current session if present.

        Returns:
        - dict[str, object]: Snapshot describing the resulting empty-mode state.
        """

        async with self._state_lock:
            await self._close_unlocked()
            self._sync_app_state()
            return self.snapshot()

    def snapshot(self) -> dict[str, object]:
        """
        Return a serializable description of current session state.

        Args:
        - None (None): This method reads current session fields only.

        Returns:
        - dict[str, object]: Mode, workspace path, current file, and empty-workspace fields.
        """

        return {
            "mode": self._mode,
            "workspacePath": str(self._workspace_path) if self._workspace_path else None,
            "currentFile": self._current_file,
            "isEmptyWorkspace": self._is_empty_workspace,
        }

    def mark_current_file(self, relative_path: str | None) -> None:
        """
        Track the active folder-mode file for UI state.

        Args:
        - relative_path (str | None): Relative file path to mark as current.

        Returns:
        - None: Session state is updated in memory.
        """

        self._current_file = relative_path
        self._sync_app_state()

    def refresh_empty_workspace_state(self) -> None:
        """
        Recompute empty-folder state from the active directory handler.

        Args:
        - None (None): This method inspects the active folder handler when present.

        Returns:
        - None: Empty-workspace flag is updated in memory.
        """

        if isinstance(self._handler, DirectoryHandler):
            self._is_empty_workspace = len(self._handler.list_files()) == 0
            self._sync_app_state()

    def mark_internal_write(self) -> None:
        """
        Record the timestamp of an internal write operation.

        Args:
        - None (None): This method updates the session write timestamp.

        Returns:
        - None: Subsequent watcher events may be ignored briefly.
        """

        self._last_internal_write_at = time.monotonic()
        self._sync_app_state()

    def should_ignore_watcher_event(self) -> bool:
        """
        Determine whether a watcher event likely came from an internal write.

        Args:
        - None (None): This method compares wall-clock deltas only.

        Returns:
        - bool: True when the event should be ignored.
        """

        return (time.monotonic() - self._last_internal_write_at) < 0.5

    async def cleanup(self) -> None:
        """
        Stop watchers and clean all active handler resources.

        Args:
        - None (None): This method tears down current session state.

        Returns:
        - None: Session is returned to empty mode.
        """

        async with self._state_lock:
            await self._close_unlocked()
            self._sync_app_state()

    async def _close_unlocked(self) -> None:
        """
        Close the active session without acquiring the state lock.

        Args:
        - None (None): Callers must already hold the session state lock.

        Returns:
        - None: Active observer and handler are cleaned up, then state resets.
        """

        self._stop_observer_unlocked()
        if self._handler is not None:
            self._handler.cleanup()
        self._mode = "empty"
        self._handler = None
        self._workspace_path = None
        self._current_file = None
        self._is_empty_workspace = False

    def _restart_observer_unlocked(self) -> None:
        """
        Recreate the watchdog observer for the active workspace.

        Args:
        - None (None): This method uses current handler and mode fields.

        Returns:
        - None: A new observer is started when a workspace is active.
        """

        self._stop_observer_unlocked()
        if self._mode == "empty" or self._handler is None:
            return

        observer = Observer()
        if self._mode == "file":
            assert isinstance(self._handler, FileHandler)
            event_handler = self._event_handler_factory(
                target_file=self._handler.filepath,
                notify_callback=self._notify_callback,
                should_ignore=self.should_ignore_watcher_event,
            )
            watch_path = str(self._handler.filepath.parent)
            recursive = False
        else:
            assert isinstance(self._handler, DirectoryHandler)
            event_handler = self._event_handler_factory(
                root_directory=self._handler.directory,
                notify_callback=self._notify_callback,
                should_ignore=self.should_ignore_watcher_event,
            )
            watch_path = str(self._handler.directory)
            recursive = True

        observer.schedule(event_handler, path=watch_path, recursive=recursive)
        observer.start()
        self._observer = observer

    def _stop_observer_unlocked(self) -> None:
        """
        Stop and join the current watchdog observer if one exists.

        Args:
        - None (None): This method inspects current observer state only.

        Returns:
        - None: Observer is stopped and discarded.
        """

        if self._observer is None:
            return

        self._observer.stop()
        self._observer.join(timeout=3)
        self._observer = None

    def _sync_app_state(self) -> None:
        """
        Mirror session fields onto FastAPI ``app.state`` for route compatibility.

        Args:
        - None (None): This method writes current session values into app state.

        Returns:
        - None: App state is updated in place.
        """

        self._app.state.mode = self._mode
        self._app.state.handler = self._handler
        self._app.state.current_file = self._current_file
        self._app.state.last_internal_write_at = self._last_internal_write_at
        self._app.state.workspace_path = self._workspace_path
        self._app.state.is_empty_workspace = self._is_empty_workspace
