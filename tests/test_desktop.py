"""Tests for desktop app module and desktop-aware server routes."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from markdown_os.directory_handler import DirectoryHandler
from markdown_os.file_handler import FileHandler
from markdown_os.server import create_app

_has_webview = True
try:
    import webview  # noqa: F401
except ImportError:
    _has_webview = False

requires_webview = pytest.mark.skipif(
    not _has_webview, reason="pywebview not installed"
)


# --- Server desktop route tests ---


def _build_desktop_client(markdown_path: Path) -> TestClient:
    """Create a TestClient with desktop=True for a single file."""
    app = create_app(FileHandler(markdown_path), desktop=True)
    return TestClient(app)


def _build_desktop_folder_client(workspace_path: Path) -> TestClient:
    """Create a TestClient with desktop=True for a directory."""
    app = create_app(DirectoryHandler(workspace_path), mode="folder", desktop=True)
    return TestClient(app)


def test_desktop_mode_endpoint_returns_true(tmp_path: Path) -> None:
    """GET /api/desktop returns desktop=True when server is in desktop mode."""
    md = tmp_path / "test.md"
    md.write_text("# Hello", encoding="utf-8")

    with _build_desktop_client(md) as client:
        response = client.get("/api/desktop")

    assert response.status_code == 200
    assert response.json() == {"desktop": True}


def test_desktop_mode_endpoint_returns_false_when_not_desktop(tmp_path: Path) -> None:
    """GET /api/desktop returns desktop=False in normal CLI mode."""
    md = tmp_path / "test.md"
    md.write_text("# Hello", encoding="utf-8")

    app = create_app(FileHandler(md))
    with TestClient(app) as client:
        response = client.get("/api/desktop")

    assert response.status_code == 200
    assert response.json() == {"desktop": False}


def test_desktop_mode_does_not_break_existing_routes(tmp_path: Path) -> None:
    """Existing routes still work when desktop=True."""
    md = tmp_path / "test.md"
    md.write_text("# Content", encoding="utf-8")

    with _build_desktop_client(md) as client:
        # Root page
        root = client.get("/")
        assert root.status_code == 200

        # Mode endpoint
        mode = client.get("/api/mode")
        assert mode.status_code == 200
        assert mode.json() == {"mode": "file"}

        # Content endpoint
        content = client.get("/api/content")
        assert content.status_code == 200
        assert content.json()["content"] == "# Content"


def test_desktop_folder_mode_routes(tmp_path: Path) -> None:
    """Desktop folder mode serves file tree and content correctly."""
    md = tmp_path / "doc.md"
    md.write_text("# Doc", encoding="utf-8")

    with _build_desktop_folder_client(tmp_path) as client:
        desktop = client.get("/api/desktop")
        assert desktop.json() == {"desktop": True}

        mode = client.get("/api/mode")
        assert mode.json() == {"mode": "folder"}

        tree = client.get("/api/file-tree")
        assert tree.status_code == 200

        content = client.get("/api/content?file=doc.md")
        assert content.status_code == 200
        assert content.json()["content"] == "# Doc"


# --- Desktop module unit tests ---


@requires_webview
def test_resolve_initial_path_with_no_args() -> None:
    """No arguments returns None (show welcome screen)."""
    from markdown_os.desktop import _resolve_initial_path

    assert _resolve_initial_path(["app"]) is None


@requires_webview
def test_resolve_initial_path_with_valid_file(tmp_path: Path) -> None:
    """Valid file path is resolved correctly."""
    from markdown_os.desktop import _resolve_initial_path

    md = tmp_path / "test.md"
    md.write_text("# Test", encoding="utf-8")

    result = _resolve_initial_path(["app", str(md)])
    assert result == md.resolve()


@requires_webview
def test_resolve_initial_path_with_valid_directory(tmp_path: Path) -> None:
    """Valid directory path is resolved correctly."""
    from markdown_os.desktop import _resolve_initial_path

    result = _resolve_initial_path(["app", str(tmp_path)])
    assert result == tmp_path.resolve()


@requires_webview
def test_resolve_initial_path_with_nonexistent_path() -> None:
    """Nonexistent path returns None."""
    from markdown_os.desktop import _resolve_initial_path

    result = _resolve_initial_path(["app", "/nonexistent/path/file.md"])
    assert result is None


@requires_webview
def test_desktop_api_open_path_file(tmp_path: Path) -> None:
    """DesktopApi.open_path validates and starts server for a markdown file."""
    from markdown_os.desktop import DesktopApi

    md = tmp_path / "test.md"
    md.write_text("# Hello", encoding="utf-8")

    mock_window = MagicMock()
    api = DesktopApi(mock_window)

    with patch.object(api, "_start_server", return_value="http://127.0.0.1:8000"):
        result = api.open_path(str(md))

    assert "url" in result
    assert result["url"] == "http://127.0.0.1:8000"
    mock_window.set_title.assert_called_once()
    assert "test.md" in mock_window.set_title.call_args[0][0]


@requires_webview
def test_desktop_api_open_path_folder(tmp_path: Path) -> None:
    """DesktopApi.open_path validates and starts server for a directory."""
    from markdown_os.desktop import DesktopApi

    md = tmp_path / "doc.md"
    md.write_text("# Doc", encoding="utf-8")

    mock_window = MagicMock()
    api = DesktopApi(mock_window)

    with patch.object(api, "_start_server", return_value="http://127.0.0.1:8001"):
        result = api.open_path(str(tmp_path))

    assert "url" in result
    assert result["url"] == "http://127.0.0.1:8001"


@requires_webview
def test_desktop_api_open_path_nonexistent() -> None:
    """DesktopApi.open_path returns error for nonexistent path."""
    from markdown_os.desktop import DesktopApi

    mock_window = MagicMock()
    api = DesktopApi(mock_window)

    result = api.open_path("/nonexistent/path.md")
    assert "error" in result


@requires_webview
def test_desktop_api_open_path_non_markdown(tmp_path: Path) -> None:
    """DesktopApi.open_path rejects non-markdown files."""
    from markdown_os.desktop import DesktopApi

    txt = tmp_path / "test.txt"
    txt.write_text("hello", encoding="utf-8")

    mock_window = MagicMock()
    api = DesktopApi(mock_window)

    result = api.open_path(str(txt))
    assert "error" in result
    assert "markdown" in result["error"].lower()


@requires_webview
def test_desktop_api_open_path_empty_folder(tmp_path: Path) -> None:
    """DesktopApi.open_path rejects folders with no markdown files."""
    from markdown_os.desktop import DesktopApi

    mock_window = MagicMock()
    api = DesktopApi(mock_window)

    result = api.open_path(str(tmp_path))
    assert "error" in result
    assert "no markdown" in result["error"].lower()


def test_windows_desktop_spec_collects_pythonnet_runtime() -> None:
    """Windows PyInstaller spec includes pythonnet/webview runtime assets."""
    spec_text = Path("markdown_os.spec").read_text(encoding="utf-8")

    assert 'collect_dynamic_libs("pythonnet")' in spec_text
    assert 'collect_data_files("pythonnet", include_py_files=False)' in spec_text
    assert '"clr"' in spec_text
    assert '"webview.platforms.winforms"' in spec_text
    assert 'upx_enabled = False' in spec_text
    assert '"Python.Runtime.dll"' in spec_text
