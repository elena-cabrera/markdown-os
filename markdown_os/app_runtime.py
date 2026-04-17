"""Shared runtime helpers for CLI and desktop server startup."""

from __future__ import annotations

import socket
from pathlib import Path

import typer
from fastapi import FastAPI

from markdown_os.directory_handler import DirectoryHandler
from markdown_os.file_handler import FileHandler


def _normalize_path(path: Path) -> Path:
    """
    Normalize a user-supplied path while tolerating share/UNC resolve failures.

    Args:
    - path (Path): User-supplied path that may point to a local or network share target.

    Returns:
    - Path: Best-effort absolute path. Prefers ``Path.resolve()`` but falls back to an absolute path when resolving raises ``OSError``.
    """

    expanded = path.expanduser()
    try:
        return expanded.resolve()
    except OSError:
        # Windows network shares (including WSL UNC paths like \\wsl.localhost\...)
        # may raise during resolve() even though the path is valid and accessible.
        return expanded.absolute()


def validate_markdown_file(filepath: Path) -> Path:
    """
    Validate and normalize a markdown file path.

    Args:
    - filepath (Path): Path supplied by the caller for a markdown file target.

    Returns:
    - Path: Fully resolved markdown file path when validation succeeds.
    """

    resolved_path = _normalize_path(filepath)
    if not resolved_path.exists():
        raise typer.BadParameter(f"File does not exist: {resolved_path}")
    if not resolved_path.is_file():
        raise typer.BadParameter(f"Path is not a file: {resolved_path}")
    if resolved_path.suffix.lower() not in {".md", ".markdown"}:
        raise typer.BadParameter("Only markdown files are supported (.md, .markdown).")
    return resolved_path


def validate_markdown_directory(directory: Path) -> Path:
    """
    Validate and normalize a directory path.

    Args:
    - directory (Path): Directory path supplied by the caller.

    Returns:
    - Path: Fully resolved directory path when validation succeeds.
    """

    resolved_path = _normalize_path(directory)
    if not resolved_path.exists():
        raise typer.BadParameter(f"Path does not exist: {resolved_path}")
    if not resolved_path.is_dir():
        raise typer.BadParameter(f"Path is not a directory: {resolved_path}")
    return resolved_path


def resolve_target_path(
    path: Path,
    *,
    allow_file: bool = True,
    allow_folder: bool = True,
) -> tuple[Path, str]:
    """
    Resolve a file-or-folder target and return its runtime mode.

    Args:
    - path (Path): User-supplied file or directory path.
    - allow_file (bool): Whether markdown file targets are accepted.
    - allow_folder (bool): Whether directory targets are accepted.

    Returns:
    - tuple[Path, str]: Resolved path and mode string (`"file"` or `"folder"`).
    """

    resolved_path = _normalize_path(path)
    if not resolved_path.exists():
        raise typer.BadParameter(f"Path does not exist: {resolved_path}")

    if resolved_path.is_file():
        if not allow_file:
            raise typer.BadParameter("File targets are not allowed for this command.")
        return validate_markdown_file(resolved_path), "file"

    if resolved_path.is_dir():
        if not allow_folder:
            raise typer.BadParameter("Directory targets are not allowed for this command.")
        return validate_markdown_directory(resolved_path), "folder"

    raise typer.BadParameter(f"Path is neither a file nor directory: {resolved_path}")


def build_handler_for_target(path: Path, mode: str) -> FileHandler | DirectoryHandler:
    """
    Build the correct handler type for a resolved runtime target.

    Args:
    - path (Path): Resolved file or folder path to serve.
    - mode (str): Runtime mode (`"file"` or `"folder"`).

    Returns:
    - FileHandler | DirectoryHandler: Handler instance matching the chosen mode.
    """

    if mode == "file":
        return FileHandler(path)
    if mode == "folder":
        return DirectoryHandler(path)
    raise ValueError("mode must be either 'file' or 'folder'.")


def build_editor_app(
    *,
    mode: str,
    handler: FileHandler | DirectoryHandler | None,
    desktop: bool = False,
) -> FastAPI:
    """
    Build the FastAPI editor application for the selected runtime mode.

    Args:
    - mode (str): Runtime mode (`"empty"`, `"file"`, or `"folder"`).
    - handler (FileHandler | DirectoryHandler | None): Initial workspace handler.
    - desktop (bool): Whether desktop-specific routes and behavior should be enabled.

    Returns:
    - FastAPI: Configured application instance ready for Uvicorn.
    """

    from markdown_os.server import create_app

    return create_app(handler, mode=mode, desktop=desktop)


def _is_port_available(host: str, port: int) -> bool:
    """
    Check whether a TCP port can be bound on the requested host.

    Args:
    - host (str): Hostname or IP address to probe.
    - port (int): TCP port number to test.

    Returns:
    - bool: True when the port can be bound successfully.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def find_available_port(host: str = "127.0.0.1", start_port: int = 8000) -> int:
    """
    Locate the first available TCP port from the requested starting point.

    Args:
    - host (str): Host interface that will be bound by the server.
    - start_port (int): First port candidate to probe.

    Returns:
    - int: First bindable port in the inclusive range 1-65535.
    """

    if start_port < 1 or start_port > 65535:
        raise typer.BadParameter("Start port must be between 1 and 65535.")

    for candidate_port in range(start_port, 65536):
        if _is_port_available(host=host, port=candidate_port):
            return candidate_port

    raise typer.BadParameter("No available TCP port found in range 8000-65535.")
