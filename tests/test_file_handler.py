"""Tests for file read/write safety primitives."""

from pathlib import Path

import pytest
import portalocker

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


def test_read_falls_back_when_shared_lock_is_unavailable(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Verify reads still work when shared file locking is unavailable.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.
    - monkeypatch (pytest.MonkeyPatch): Pytest monkeypatch fixture.

    Returns:
    - None: Assertion validates unlocked read fallback behavior.
    """

    markdown_path = tmp_path / "document.md"
    markdown_path.write_text("content", encoding="utf-8")
    file_handler = FileHandler(markdown_path)

    def _fail_lock(*_args: object, **_kwargs: object) -> None:
        raise portalocker.LockException("locking unavailable")

    monkeypatch.setattr(portalocker, "lock", _fail_lock)

    assert file_handler.read() == "content"


def test_read_falls_back_when_lock_file_cannot_be_opened(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Verify reads still work when the lock file cannot be opened.

    This models environments like Windows UNC paths (e.g. WSL shares) where creating
    or opening the advisory lock file can fail even though the markdown file itself
    remains readable.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.
    - monkeypatch (pytest.MonkeyPatch): Pytest monkeypatch fixture.

    Returns:
    - None: Assertion validates unlocked read fallback when lock IO fails.
    """

    markdown_path = tmp_path / "document.md"
    markdown_path.write_text("content", encoding="utf-8")
    file_handler = FileHandler(markdown_path)

    original_open = Path.open

    def _fail_lock_open(self: Path, *args: object, **kwargs: object):  # type: ignore[no-untyped-def]
        if self.name.endswith(".lock"):
            raise OSError("cannot open lock file")
        return original_open(self, *args, **kwargs)

    monkeypatch.setattr(Path, "open", _fail_lock_open, raising=True)

    assert file_handler.read() == "content"
