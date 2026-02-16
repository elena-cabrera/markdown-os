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


def test_cleanup_removes_lock_file_after_read(tmp_path: Path) -> None:
    """
    Verify cleanup deletes the lock file created during read.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate cleanup after read lock creation.
    """

    markdown_path = tmp_path / "document.md"
    markdown_path.write_text("content", encoding="utf-8")
    file_handler = FileHandler(markdown_path)
    lock_path = markdown_path.with_suffix(".md.lock")

    file_handler.read()
    assert lock_path.exists()

    file_handler.cleanup()
    assert not lock_path.exists()


def test_cleanup_removes_lock_file_after_write(tmp_path: Path) -> None:
    """
    Verify cleanup deletes the lock file created during write.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate cleanup after write lock creation.
    """

    markdown_path = tmp_path / "document.md"
    markdown_path.write_text("old", encoding="utf-8")
    file_handler = FileHandler(markdown_path)
    lock_path = markdown_path.with_suffix(".md.lock")

    file_handler.write("new")
    assert lock_path.exists()

    file_handler.cleanup()
    assert not lock_path.exists()


def test_cleanup_noop_when_no_io_performed(tmp_path: Path) -> None:
    """
    Verify cleanup does nothing when the handler was never used.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates no lock file is created by cleanup.
    """

    markdown_path = tmp_path / "document.md"
    markdown_path.write_text("content", encoding="utf-8")
    file_handler = FileHandler(markdown_path)
    lock_path = markdown_path.with_suffix(".md.lock")

    file_handler.cleanup()
    assert not lock_path.exists()


def test_cleanup_safe_to_call_twice(tmp_path: Path) -> None:
    """
    Verify calling cleanup multiple times does not raise.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Repeated cleanup calls complete without exceptions.
    """

    markdown_path = tmp_path / "document.md"
    markdown_path.write_text("content", encoding="utf-8")
    file_handler = FileHandler(markdown_path)

    file_handler.read()
    file_handler.cleanup()
    file_handler.cleanup()
