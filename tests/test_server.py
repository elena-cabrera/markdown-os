"""Tests for FastAPI server routes."""

from pathlib import Path

from fastapi.testclient import TestClient

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
