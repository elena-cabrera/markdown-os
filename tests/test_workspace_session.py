"""Tests for dynamic workspace session management."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
import pytest

from markdown_os.server import MarkdownPathEventHandler
from markdown_os.workspace_session import WorkspaceSession


def _build_app() -> FastAPI:
    """
    Build a lightweight FastAPI app for workspace-session tests.

    Args:
    - None (None): Test helper creates an in-memory FastAPI application.

    Returns:
    - FastAPI: App instance with mutable ``state`` storage.
    """

    return FastAPI()


@pytest.mark.asyncio
async def test_workspace_session_initializes_empty_mode() -> None:
    """
    Verify session startup defaults to empty mode with no active workspace.

    Args:
    - None (None): Test uses an in-memory FastAPI app only.

    Returns:
    - None: Assertions validate the initial empty snapshot and app-state sync.
    """

    app = _build_app()
    session = WorkspaceSession(
        app=app,
        notify_callback=lambda _path: None,
        event_handler_factory=MarkdownPathEventHandler,
    )

    assert session.snapshot() == {
        "mode": "empty",
        "workspacePath": None,
        "currentFile": None,
        "isEmptyWorkspace": False,
    }
    assert app.state.mode == "empty"
    assert app.state.handler is None


@pytest.mark.asyncio
async def test_workspace_session_can_open_and_close_folder(tmp_path: Path) -> None:
    """
    Verify a session can switch from empty mode to folder mode and back.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate folder snapshots and reset behavior.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "notes.md").write_text("# Notes", encoding="utf-8")

    app = _build_app()
    session = WorkspaceSession(
        app=app,
        notify_callback=lambda _path: None,
        event_handler_factory=MarkdownPathEventHandler,
    )

    folder_snapshot = await session.open_folder(workspace)
    assert folder_snapshot["mode"] == "folder"
    assert folder_snapshot["workspacePath"] == str(workspace.resolve())
    assert folder_snapshot["isEmptyWorkspace"] is False
    assert app.state.mode == "folder"

    empty_snapshot = await session.close_workspace()
    assert empty_snapshot == {
        "mode": "empty",
        "workspacePath": None,
        "currentFile": None,
        "isEmptyWorkspace": False,
    }
    assert app.state.mode == "empty"
    assert app.state.handler is None


@pytest.mark.asyncio
async def test_workspace_session_refreshes_empty_state_after_file_create(
    tmp_path: Path,
) -> None:
    """
    Verify empty-folder state updates after a markdown file is created.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate the empty-workspace flag refresh behavior.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)

    app = _build_app()
    session = WorkspaceSession(
        app=app,
        notify_callback=lambda _path: None,
        event_handler_factory=MarkdownPathEventHandler,
    )

    snapshot = await session.open_folder(workspace)
    assert snapshot["isEmptyWorkspace"] is True

    handler = session.handler
    assert handler is not None
    handler.create_file("first.md")
    session.refresh_empty_workspace_state()

    assert session.snapshot()["isEmptyWorkspace"] is False
    assert app.state.is_empty_workspace is False
