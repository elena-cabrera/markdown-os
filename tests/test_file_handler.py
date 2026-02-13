"""Tests for file read/write safety primitives."""

from pathlib import Path

import pytest

from markdown_os.file_handler import FileHandler, FileReadError


def test_read_returns_current_content(tmp_path: Path) -> None:
    """
    Verify read returns UTF-8 markdown text from disk.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate content returned by FileHandler.read.
    """

    markdown_path = tmp_path / "document.md"
    markdown_path.write_text("# title\n\ncontent", encoding="utf-8")
    file_handler = FileHandler(markdown_path)

    assert file_handler.read() == "# title\n\ncontent"


def test_write_replaces_content_atomically(tmp_path: Path) -> None:
    """
    Verify write updates the markdown file and metadata fields.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate write success and resulting content.
    """

    markdown_path = tmp_path / "document.md"
    markdown_path.write_text("old", encoding="utf-8")
    file_handler = FileHandler(markdown_path)

    saved = file_handler.write("new content")

    assert saved is True
    assert markdown_path.read_text(encoding="utf-8") == "new content"
    metadata = file_handler.get_metadata()
    assert metadata["size_bytes"] == len("new content")
    assert metadata["path"].endswith("document.md")


def test_read_raises_when_file_missing(tmp_path: Path) -> None:
    """
    Verify missing file paths raise a domain-specific read exception.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion checks FileReadError is raised for absent paths.
    """

    file_handler = FileHandler(tmp_path / "missing.md")

    with pytest.raises(FileReadError):
        file_handler.read()
