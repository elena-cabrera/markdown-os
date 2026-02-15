"""Tests for FastAPI server routes."""

from pathlib import Path

from fastapi.testclient import TestClient

from markdown_os.directory_handler import DirectoryHandler
from markdown_os.file_handler import FileHandler
from markdown_os.server import create_app


def _build_client(markdown_path: Path) -> TestClient:
    """
    Create a TestClient instance bound to a markdown file.

    Args:
    - markdown_path (Path): Markdown file path served by the test app.

    Returns:
    - TestClient: FastAPI test client with routes initialized.
    """

    app = create_app(FileHandler(markdown_path))
    return TestClient(app)


def _build_folder_client(workspace_path: Path) -> TestClient:
    """
    Create a TestClient instance bound to a markdown workspace directory.

    Args:
    - workspace_path (Path): Workspace directory containing markdown files.

    Returns:
    - TestClient: FastAPI test client configured for folder mode.
    """

    app = create_app(DirectoryHandler(workspace_path), mode="folder")
    return TestClient(app)


def test_get_content_returns_file_payload(tmp_path: Path) -> None:
    """
    Verify GET /api/content returns markdown and metadata.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate response status and payload structure.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("# Header", encoding="utf-8")

    with _build_client(markdown_path) as client:
        response = client.get("/api/content")

    assert response.status_code == 200
    payload = response.json()
    assert payload["content"] == "# Header"
    assert payload["metadata"]["size_bytes"] == len("# Header")


def test_get_mode_returns_file_in_single_file_mode(tmp_path: Path) -> None:
    """
    Verify mode endpoint reports file mode for single-file apps.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates /api/mode response payload.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("# Header", encoding="utf-8")

    with _build_client(markdown_path) as client:
        response = client.get("/api/mode")

    assert response.status_code == 200
    assert response.json() == {"mode": "file"}


def test_save_endpoint_updates_file(tmp_path: Path) -> None:
    """
    Verify POST /api/save writes new content to the markdown file.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate API response and file content update.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("original", encoding="utf-8")

    with _build_client(markdown_path) as client:
        response = client.post("/api/save", json={"content": "updated"})

    assert response.status_code == 200
    assert response.json()["status"] == "saved"
    assert markdown_path.read_text(encoding="utf-8") == "updated"


def test_file_tree_endpoint_returns_nested_structure_in_folder_mode(tmp_path: Path) -> None:
    """
    Verify folder mode returns a nested markdown file tree.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate tree payload structure.
    """

    workspace = tmp_path / "workspace"
    nested = workspace / "docs"
    nested.mkdir(parents=True, exist_ok=True)
    (workspace / "README.md").write_text("# Root", encoding="utf-8")
    (nested / "guide.md").write_text("# Guide", encoding="utf-8")

    with _build_folder_client(workspace) as client:
        response = client.get("/api/file-tree")

    assert response.status_code == 200
    payload = response.json()
    assert payload["type"] == "folder"
    assert payload["path"] == ""
    assert any(child["path"] == "README.md" for child in payload["children"])


def test_get_content_reads_selected_file_in_folder_mode(tmp_path: Path) -> None:
    """
    Verify folder mode content endpoint reads requested relative file path.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate folder-mode content retrieval.
    """

    workspace = tmp_path / "workspace"
    nested = workspace / "docs"
    nested.mkdir(parents=True, exist_ok=True)
    target = nested / "guide.md"
    target.write_text("# Guide", encoding="utf-8")

    with _build_folder_client(workspace) as client:
        response = client.get("/api/content", params={"file": "docs/guide.md"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["content"] == "# Guide"
    assert payload["metadata"]["relative_path"] == "docs/guide.md"


def test_get_content_requires_file_parameter_in_folder_mode(tmp_path: Path) -> None:
    """
    Verify folder mode rejects content requests without file query.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates request validation behavior.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "notes.md").write_text("text", encoding="utf-8")

    with _build_folder_client(workspace) as client:
        response = client.get("/api/content")

    assert response.status_code == 400


def test_save_endpoint_updates_selected_file_in_folder_mode(tmp_path: Path) -> None:
    """
    Verify folder mode save endpoint writes to requested relative file path.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate file-targeted save behavior.
    """

    workspace = tmp_path / "workspace"
    nested = workspace / "docs"
    nested.mkdir(parents=True, exist_ok=True)
    target = nested / "guide.md"
    target.write_text("original", encoding="utf-8")

    with _build_folder_client(workspace) as client:
        response = client.post(
            "/api/save",
            json={"content": "updated", "file": "docs/guide.md"},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "saved"
    assert target.read_text(encoding="utf-8") == "updated"


def test_file_tree_endpoint_rejected_in_single_file_mode(tmp_path: Path) -> None:
    """
    Verify file-tree endpoint is unavailable in single-file mode.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates mode-specific route guarding.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("text", encoding="utf-8")

    with _build_client(markdown_path) as client:
        response = client.get("/api/file-tree")

    assert response.status_code == 400


def test_websocket_route_accepts_client(tmp_path: Path) -> None:
    """
    Verify websocket endpoint accepts and maintains a connection.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion ensures the websocket route can receive a client message.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("hello", encoding="utf-8")

    with _build_client(markdown_path) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_text("ping")
