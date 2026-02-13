"""Tests for CLI helper behavior."""

import socket
from pathlib import Path

import pytest
import typer

from markdown_os.cli import _validate_markdown_file, find_available_port


def test_validate_markdown_file_returns_resolved_path(tmp_path: Path) -> None:
    """
    Verify markdown validation resolves valid .md files.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate successful path normalization.
    """

    markdown_path = tmp_path / "sample.md"
    markdown_path.write_text("text", encoding="utf-8")

    validated_path = _validate_markdown_file(markdown_path)

    assert validated_path == markdown_path.resolve()


def test_validate_markdown_file_rejects_invalid_suffix(tmp_path: Path) -> None:
    """
    Verify markdown validation rejects unsupported file extensions.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertion validates Typer argument errors for non-markdown files.
    """

    text_path = tmp_path / "notes.txt"
    text_path.write_text("text", encoding="utf-8")

    with pytest.raises(typer.BadParameter):
        _validate_markdown_file(text_path)


def test_find_available_port_skips_bound_port() -> None:
    """
    Verify port discovery increments when the initial port is occupied.

    Args:
    - None (None): This test binds a temporary local socket.

    Returns:
    - None: Assertions validate returned port differs from occupied port.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        occupied_port = sock.getsockname()[1]
        discovered_port = find_available_port(
            host="127.0.0.1",
            start_port=occupied_port,
        )

    assert discovered_port != occupied_port
    assert discovered_port > occupied_port
