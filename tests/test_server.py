"""Tests for FastAPI server routes."""

from pathlib import Path

from fastapi.testclient import TestClient

from markdown_os.directory_handler import DirectoryHandler
from markdown_os.file_handler import FileHandler
from markdown_os.server import MAX_IMAGE_SIZE_BYTES, create_app


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


def _build_desktop_client() -> TestClient:
    """
    Create a TestClient instance bound to desktop empty mode.

    Args:
    - None (None): Desktop mode starts without an active workspace.

    Returns:
    - TestClient: FastAPI test client configured for desktop empty mode.
    """

    app = create_app(None, mode="empty", desktop=True)
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


def test_get_mode_returns_empty_in_desktop_empty_mode() -> None:
    """
    Verify mode endpoint reports empty mode for desktop startup.

    Args:
    - None (None): Desktop client starts without an active workspace.

    Returns:
    - None: Assertion validates empty-mode response payload.
    """

    with _build_desktop_client() as client:
        response = client.get("/api/mode")

    assert response.status_code == 200
    assert response.json() == {"mode": "empty"}


def test_health_endpoint_reports_desktop_metadata() -> None:
    """
    Verify health endpoint exposes desktop runtime metadata.

    Args:
    - None (None): Desktop client starts without an active workspace.

    Returns:
    - None: Assertions validate health payload shape and values.
    """

    with _build_desktop_client() as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "mode": "empty", "desktop": True}


def test_desktop_state_returns_empty_snapshot() -> None:
    """
    Verify desktop state endpoint exposes the initial empty snapshot.

    Args:
    - None (None): Desktop client starts without an active workspace.

    Returns:
    - None: Assertions validate empty desktop snapshot fields.
    """

    with _build_desktop_client() as client:
        response = client.get("/api/desktop/state")

    assert response.status_code == 200
    assert response.json() == {
        "mode": "empty",
        "workspacePath": None,
        "currentFile": None,
        "isEmptyWorkspace": False,
    }


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


def test_empty_mode_rejects_content_requests() -> None:
    """
    Verify empty mode rejects content requests before a workspace is opened.

    Args:
    - None (None): Desktop client starts without an active workspace.

    Returns:
    - None: Assertions validate empty-mode route guarding.
    """

    with _build_desktop_client() as client:
        response = client.get("/api/content")

    assert response.status_code == 409
    assert response.json()["detail"] == "No workspace loaded."


def test_empty_mode_rejects_save_requests() -> None:
    """
    Verify empty mode rejects save requests before a workspace is opened.

    Args:
    - None (None): Desktop client starts without an active workspace.

    Returns:
    - None: Assertions validate empty-mode save guarding.
    """

    with _build_desktop_client() as client:
        response = client.post("/api/save", json={"content": "updated"})

    assert response.status_code == 409
    assert response.json()["detail"] == "No workspace loaded."


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


def test_file_tree_endpoint_returns_empty_root_for_empty_folder_mode_workspace(tmp_path: Path) -> None:
    """
    Verify folder mode returns an empty root tree for workspaces with no markdown files yet.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate empty-workspace tree payload structure.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)

    with _build_folder_client(workspace) as client:
        response = client.get("/api/file-tree")

    assert response.status_code == 200
    assert response.json() == {
        "type": "folder",
        "name": "workspace",
        "path": "",
        "children": [],
    }


def test_desktop_open_folder_switches_to_folder_mode(tmp_path: Path) -> None:
    """
    Verify desktop open-folder route switches the app into folder mode.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate snapshot response and subsequent folder APIs.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "notes.md").write_text("# Notes", encoding="utf-8")

    with _build_desktop_client() as client:
        response = client.post("/api/desktop/open-folder", json={"path": str(workspace)})
        tree_response = client.get("/api/file-tree")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["mode"] == "folder"
    assert response.json()["workspacePath"] == str(workspace.resolve())
    assert response.json()["isEmptyWorkspace"] is False
    assert tree_response.status_code == 200


def test_desktop_open_empty_folder_marks_empty_workspace(tmp_path: Path) -> None:
    """
    Verify desktop open-folder route reports empty workspaces correctly.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate empty-workspace snapshot behavior.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)

    with _build_desktop_client() as client:
        response = client.post("/api/desktop/open-folder", json={"path": str(workspace)})

    assert response.status_code == 200
    assert response.json()["mode"] == "folder"
    assert response.json()["isEmptyWorkspace"] is True


def test_desktop_open_file_switches_to_file_mode(tmp_path: Path) -> None:
    """
    Verify desktop open-file route switches the app into file mode.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate file-mode snapshot and content access.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("# Notes", encoding="utf-8")

    with _build_desktop_client() as client:
        response = client.post("/api/desktop/open-file", json={"path": str(markdown_path)})
        content_response = client.get("/api/content")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["mode"] == "file"
    assert response.json()["workspacePath"] == str(markdown_path.resolve())
    assert content_response.status_code == 200
    assert content_response.json()["content"] == "# Notes"


def test_desktop_close_workspace_returns_to_empty_mode(tmp_path: Path) -> None:
    """
    Verify desktop close-workspace route returns the app to empty mode.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate empty-mode snapshot after closing.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "notes.md").write_text("# Notes", encoding="utf-8")

    with _build_desktop_client() as client:
        client.post("/api/desktop/open-folder", json={"path": str(workspace)})
        response = client.post("/api/desktop/close-workspace")
        state_response = client.get("/api/desktop/state")

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "mode": "empty",
        "workspacePath": None,
        "currentFile": None,
        "isEmptyWorkspace": False,
    }
    assert state_response.status_code == 200
    assert state_response.json()["mode"] == "empty"


def test_desktop_routes_are_hidden_in_non_desktop_mode(tmp_path: Path) -> None:
    """
    Verify desktop routes are unavailable for normal CLI/browser app instances.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate desktop route guarding outside desktop mode.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("# Notes", encoding="utf-8")

    with _build_client(markdown_path) as client:
        state_response = client.get("/api/desktop/state")
        open_response = client.post("/api/desktop/open-file", json={"path": str(markdown_path)})

    assert state_response.status_code == 404
    assert open_response.status_code == 404


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


def test_upload_image_saves_file_and_returns_relative_path(tmp_path: Path) -> None:
    """
    Verify POST /api/images stores an uploaded image and returns its relative path.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate response payload and saved file content.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("hello", encoding="utf-8")

    with _build_client(markdown_path) as client:
        response = client.post(
            "/api/images",
            files={"file": ("paste.png", b"png-bytes", "image/png")},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["path"].startswith("images/")
    saved_name = payload["filename"]
    saved_path = tmp_path / "images" / saved_name
    assert saved_path.exists()
    assert saved_path.read_bytes() == b"png-bytes"


def test_upload_image_rejects_unsupported_extension(tmp_path: Path) -> None:
    """
    Verify POST /api/images rejects files that are not in the image extension allowlist.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates unsupported extension handling.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("hello", encoding="utf-8")

    with _build_client(markdown_path) as client:
        response = client.post(
            "/api/images",
            files={"file": ("archive.tiff", b"image-data", "image/tiff")},
        )

    assert response.status_code == 400
    assert "Unsupported image format" in response.json()["detail"]


def test_upload_image_rejects_empty_file(tmp_path: Path) -> None:
    """
    Verify POST /api/images rejects empty uploads.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates empty upload handling.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("hello", encoding="utf-8")

    with _build_client(markdown_path) as client:
        response = client.post(
            "/api/images",
            files={"file": ("paste.png", b"", "image/png")},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Empty file uploaded."


def test_upload_image_rejects_oversized_file(tmp_path: Path) -> None:
    """
    Verify POST /api/images enforces maximum upload size.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates upload size validation.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("hello", encoding="utf-8")
    oversized_payload = b"a" * (MAX_IMAGE_SIZE_BYTES + 1)

    with _build_client(markdown_path) as client:
        response = client.post(
            "/api/images",
            files={"file": ("big.png", oversized_payload, "image/png")},
        )

    assert response.status_code == 400
    assert "Image too large" in response.json()["detail"]


def test_serve_image_returns_file_content(tmp_path: Path) -> None:
    """
    Verify GET /images/{filename} serves files from the images directory.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate successful image retrieval.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("hello", encoding="utf-8")
    images_dir = tmp_path / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    image_path = images_dir / "shot.png"
    image_path.write_bytes(b"img-data")

    with _build_client(markdown_path) as client:
        response = client.get("/images/shot.png")

    assert response.status_code == 200
    assert response.content == b"img-data"


def test_serve_image_returns_not_found_for_missing_file(tmp_path: Path) -> None:
    """
    Verify GET /images/{filename} returns 404 when the file does not exist.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates missing file behavior.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("hello", encoding="utf-8")

    with _build_client(markdown_path) as client:
        response = client.get("/images/missing.png")

    assert response.status_code == 404


def test_serve_image_rejects_directory_traversal(tmp_path: Path) -> None:
    """
    Verify GET /images/{filename} blocks path traversal attempts.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates security checks for invalid paths.
    """

    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("hello", encoding="utf-8")

    with _build_client(markdown_path) as client:
        response = client.get("/images/%2E%2E/%2E%2E/server.py")

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid image path."


def test_upload_image_uses_workspace_images_directory_in_folder_mode(tmp_path: Path) -> None:
    """
    Verify folder mode writes uploads to the workspace-level images directory.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate folder-mode upload storage location.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "notes.md").write_text("hello", encoding="utf-8")

    with _build_folder_client(workspace) as client:
        response = client.post(
            "/api/images",
            files={"file": ("drop.png", b"folder-image", "image/png")},
        )

    assert response.status_code == 200
    payload = response.json()
    saved_path = workspace / payload["path"]
    assert saved_path.exists()
    assert saved_path.read_bytes() == b"folder-image"


def test_create_file_endpoint_creates_file_in_folder_mode(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)

    with _build_folder_client(workspace) as client:
        response = client.post("/api/files/create", json={"path": "docs/new.md"})

    assert response.status_code == 200
    assert response.json() == {"path": "docs/new.md"}
    assert (workspace / "docs" / "new.md").exists()


def test_rename_file_endpoint_renames_file_in_folder_mode(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "notes.md").write_text("text", encoding="utf-8")

    with _build_folder_client(workspace) as client:
        response = client.post(
            "/api/files/rename",
            json={"path": "notes.md", "new_name": "renamed.md"},
        )

    assert response.status_code == 200
    assert response.json() == {"path": "renamed.md"}
    assert (workspace / "renamed.md").exists()
    assert not (workspace / "notes.md").exists()


def test_delete_file_endpoint_deletes_file_in_folder_mode(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    target = workspace / "notes.md"
    target.write_text("text", encoding="utf-8")

    with _build_folder_client(workspace) as client:
        response = client.request("DELETE", "/api/files/delete", json={"path": "notes.md"})

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert not target.exists()


def test_file_operation_routes_return_404_in_file_mode(tmp_path: Path) -> None:
    markdown_path = tmp_path / "notes.md"
    markdown_path.write_text("hello", encoding="utf-8")

    with _build_client(markdown_path) as client:
        create_response = client.post("/api/files/create", json={"path": "new.md"})
        rename_response = client.post(
            "/api/files/rename",
            json={"path": "notes.md", "new_name": "renamed.md"},
        )
        delete_response = client.request(
            "DELETE",
            "/api/files/delete",
            json={"path": "notes.md"},
        )

    assert create_response.status_code == 404
    assert rename_response.status_code == 404
    assert delete_response.status_code == 404


def test_create_file_endpoint_returns_conflict_for_existing_file(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "notes.md").write_text("text", encoding="utf-8")

    with _build_folder_client(workspace) as client:
        response = client.post("/api/files/create", json={"path": "notes.md"})

    assert response.status_code == 409
