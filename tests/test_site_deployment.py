"""Tests for Vercel static deployment layout."""

from __future__ import annotations

import hashlib
from pathlib import Path


def _repo_root() -> Path:
    """Return the repository root path.

    Args:
    - None (None): This helper derives the root from the test file location.

    Returns:
    - Path: Absolute repository root path.
    """

    return Path(__file__).resolve().parents[1]


def _sha256(path: Path) -> str:
    """Return a stable content hash for a file.

    Args:
    - path (Path): File path to hash.

    Returns:
    - str: SHA-256 hex digest for the file bytes.
    """

    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_vercel_site_contains_web_editor_entrypoint() -> None:
    """Verify Vercel output includes the web editor route."""

    root = _repo_root()
    source = root / "markdown_os" / "static" / "index.html"
    deployed = root / "site" / "app" / "index.html"

    assert deployed.is_file()
    assert deployed.read_text(encoding="utf-8") == source.read_text(encoding="utf-8")
    assert '/static/js/storage-backend.js' in deployed.read_text(encoding="utf-8")


def test_vercel_site_contains_static_editor_assets() -> None:
    """Verify Vercel output has all editor assets under /static."""

    root = _repo_root()
    source_root = root / "markdown_os" / "static"
    deployed_root = root / "site" / "static"
    required_files = [
        Path("favicon.svg"),
        Path("css/styles.css"),
        Path("css/themes.css"),
        Path("js/storage-backend.js"),
        Path("js/editor.js"),
        Path("vendor/marked/marked.min.js"),
        Path("vendor/mermaid/mermaid.min.js"),
    ]

    for relative_path in required_files:
        source = source_root / relative_path
        deployed = deployed_root / relative_path
        assert deployed.is_file(), f"Missing deployed asset: {relative_path}"
        assert _sha256(deployed) == _sha256(source), f"Outdated deployed asset: {relative_path}"


def test_landing_links_to_web_app() -> None:
    """Verify the landing page exposes the deployed web app."""

    index = (_repo_root() / "site" / "index.html").read_text(encoding="utf-8")

    assert 'href="/app"' in index
    assert "Try Web App" in index
