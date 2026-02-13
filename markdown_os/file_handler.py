"""File IO primitives for Markdown-OS."""

from __future__ import annotations

import fcntl
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


class FileReadError(RuntimeError):
    """Raised when reading markdown content fails."""


class FileWriteError(RuntimeError):
    """Raised when writing markdown content fails."""


class FileHandler:
    """Coordinate safe markdown file access for the HTTP server."""

    def __init__(self, filepath: Path) -> None:
        """
        Create a file handler for a single markdown file.

        Args:
        - filepath (Path): Absolute or relative path to the markdown file.

        Returns:
        - None: This initializer stores normalized paths for later operations.
        """

        self._filepath = filepath.expanduser().resolve()
        self._lock_path = self._filepath.with_suffix(f"{self._filepath.suffix}.lock")

    @property
    def filepath(self) -> Path:
        """
        Expose the markdown file path served by this handler.

        Args:
        - None (None): This property does not accept arguments.

        Returns:
        - Path: The resolved markdown file path for read and write operations.
        """

        return self._filepath

    def read(self) -> str:
        """
        Read markdown content from disk using a shared lock.

        Args:
        - None (None): This method reads from the configured path only.

        Returns:
        - str: UTF-8 decoded markdown content currently stored on disk.
        """

        if not self._filepath.exists():
            raise FileReadError(f"File does not exist: {self._filepath}")

        with self._acquire_lock(exclusive=False):
            try:
                return self._filepath.read_text(encoding="utf-8")
            except UnicodeDecodeError as exc:
                raise FileReadError(
                    f"File is not valid UTF-8 text: {self._filepath}"
                ) from exc
            except OSError as exc:
                raise FileReadError(f"Failed to read file: {self._filepath}") from exc

    def write(self, content: str) -> bool:
        """
        Persist markdown content atomically using an exclusive lock.

        Args:
        - content (str): Full markdown document content to save.

        Returns:
        - bool: True when content is written and moved into place successfully.
        """

        with self._acquire_lock(exclusive=True):
            temp_path = self._write_temporary_file(content)
            try:
                os.replace(temp_path, self._filepath)
            except OSError as exc:
                self._safe_remove(temp_path)
                raise FileWriteError(f"Failed to replace file: {self._filepath}") from exc
            return True

    def get_metadata(self) -> dict[str, Any]:
        """
        Return current file metadata used by API responses.

        Args:
        - None (None): This method inspects the configured markdown file only.

        Returns:
        - dict[str, Any]: File size and timestamp metadata for the markdown file.
        """

        if not self._filepath.exists():
            raise FileReadError(f"File does not exist: {self._filepath}")

        try:
            stat_result = self._filepath.stat()
        except OSError as exc:
            raise FileReadError(f"Failed to inspect file: {self._filepath}") from exc

        return {
            "path": str(self._filepath),
            "size_bytes": stat_result.st_size,
            "modified_at": stat_result.st_mtime,
            "created_at": stat_result.st_ctime,
        }

    @contextmanager
    def _acquire_lock(self, exclusive: bool) -> Iterator[None]:
        """
        Acquire and release a POSIX file lock around an operation.

        Args:
        - exclusive (bool): True for write locks, False for shared read locks.

        Returns:
        - Iterator[None]: Context manager yielding control while the lock is held.
        """

        self._lock_path.parent.mkdir(parents=True, exist_ok=True)
        with self._lock_path.open("a+", encoding="utf-8") as lock_file:
            lock_mode = fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH
            try:
                fcntl.flock(lock_file.fileno(), lock_mode)
            except OSError as exc:
                raise FileWriteError(f"Failed to acquire lock: {self._lock_path}") from exc
            try:
                yield
            finally:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)

    def _write_temporary_file(self, content: str) -> Path:
        """
        Write content to a temporary file and fsync it.

        Args:
        - content (str): Markdown content to stage before atomic replacement.

        Returns:
        - Path: Temporary file path that contains the full staged content.
        """

        self._filepath.parent.mkdir(parents=True, exist_ok=True)
        file_descriptor, temp_name = tempfile.mkstemp(
            prefix=f".{self._filepath.name}.",
            suffix=".tmp",
            dir=str(self._filepath.parent),
        )
        temp_path = Path(temp_name)

        try:
            with os.fdopen(file_descriptor, "w", encoding="utf-8") as temp_file:
                temp_file.write(content)
                temp_file.flush()
                os.fsync(temp_file.fileno())
        except OSError as exc:
            self._safe_remove(temp_path)
            raise FileWriteError(
                f"Failed to write temporary file for: {self._filepath}"
            ) from exc

        return temp_path

    def _safe_remove(self, path: Path) -> None:
        """
        Remove a temporary file while suppressing cleanup failures.

        Args:
        - path (Path): Temporary path that should be removed if it exists.

        Returns:
        - None: Cleanup has best-effort semantics and never raises.
        """

        try:
            if path.exists():
                path.unlink()
        except OSError:
            return
