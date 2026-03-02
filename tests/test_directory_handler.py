"""Tests for directory workspace handling and file-tree construction."""

from pathlib import Path

import pytest

from markdown_os.directory_handler import DirectoryHandler
from markdown_os.file_handler import FileReadError, FileWriteError


def test_list_files_recursive_returns_relative_markdown_paths(tmp_path: Path) -> None:
    """
    Verify recursive discovery returns markdown files relative to root.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate recursive markdown path discovery.
    """

    workspace = tmp_path / "workspace"
    nested = workspace / "docs" / "guides"
    nested.mkdir(parents=True, exist_ok=True)
    (workspace / "README.md").write_text("# Root", encoding="utf-8")
    (nested / "intro.markdown").write_text("# Intro", encoding="utf-8")
    (workspace / "notes.txt").write_text("ignore", encoding="utf-8")

    handler = DirectoryHandler(workspace)

    assert [path.as_posix() for path in handler.list_files()] == [
        "docs/guides/intro.markdown",
        "README.md",
    ]


def test_get_file_tree_builds_nested_folder_structure(tmp_path: Path) -> None:
    """
    Verify tree payload includes nested folders and file nodes.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate folder/file node arrangement.
    """

    workspace = tmp_path / "workspace"
    nested = workspace / "docs" / "guides"
    nested.mkdir(parents=True, exist_ok=True)
    (workspace / "README.md").write_text("# Root", encoding="utf-8")
    (nested / "intro.md").write_text("# Intro", encoding="utf-8")

    tree = DirectoryHandler(workspace).get_file_tree()

    assert tree["type"] == "folder"
    assert tree["path"] == ""
    assert tree["children"][0]["type"] == "folder"
    assert tree["children"][0]["name"] == "docs"
    assert tree["children"][0]["children"][0]["name"] == "guides"
    assert tree["children"][1] == {
        "type": "file",
        "name": "README.md",
        "path": "README.md",
    }


def test_get_file_handler_reuses_cached_instances(tmp_path: Path) -> None:
    """
    Verify repeated lookup returns the same cached FileHandler instance.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate in-memory FileHandler caching.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "notes.md").write_text("# Notes", encoding="utf-8")
    handler = DirectoryHandler(workspace)

    first = handler.get_file_handler("notes.md")
    second = handler.get_file_handler("notes.md")

    assert first is second


def test_validate_file_path_rejects_directory_traversal(tmp_path: Path) -> None:
    """
    Verify traversal attempts are rejected by path validation.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate workspace boundary enforcement.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    outside = tmp_path / "outside.md"
    outside.write_text("# Outside", encoding="utf-8")
    handler = DirectoryHandler(workspace)

    assert handler.validate_file_path("../outside.md") is False


def test_get_file_handler_raises_for_non_markdown_files(tmp_path: Path) -> None:
    """
    Verify non-markdown file requests are rejected by file handler lookup.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates extension checks for get_file_handler.
    """

    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "notes.txt").write_text("nope", encoding="utf-8")
    handler = DirectoryHandler(workspace)

    with pytest.raises(ValueError):
        handler.get_file_handler("notes.txt")

def test_create_file_creates_empty_file(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    handler = DirectoryHandler(workspace)

    created = handler.create_file("docs/new.md")

    assert created == (workspace / "docs" / "new.md").resolve()
    assert created.read_text(encoding="utf-8") == ""


def test_rename_path_renames_file(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    original = workspace / "notes.md"
    original.write_text("text", encoding="utf-8")
    handler = DirectoryHandler(workspace)

    renamed = handler.rename_path("notes.md", "renamed.md")

    assert renamed == (workspace / "renamed.md").resolve()
    assert not original.exists()
    assert renamed.exists()


def test_delete_file_removes_file(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    target = workspace / "notes.md"
    target.write_text("text", encoding="utf-8")
    handler = DirectoryHandler(workspace)

    handler.delete_file("notes.md")

    assert not target.exists()


def test_delete_file_raises_for_missing_path(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    handler = DirectoryHandler(workspace)

    with pytest.raises(FileReadError):
        handler.delete_file("missing.md")


def test_create_file_raises_when_file_exists(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "notes.md").write_text("text", encoding="utf-8")
    handler = DirectoryHandler(workspace)

    with pytest.raises(FileWriteError):
        handler.create_file("notes.md")
