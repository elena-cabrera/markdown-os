"""Tests for CLI helper behavior."""

import socket
from pathlib import Path

import pytest
import typer
from typer.testing import CliRunner

import markdown_os.cli as cli_module
from markdown_os.cli import _validate_markdown_file, app, find_available_port


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


def test_cli_exposes_open_subcommand() -> None:
    """
    Verify CLI help shows the explicit open subcommand entry.

    Args:
    - None (None): Test uses Typer's in-process CLI runner.

    Returns:
    - None: Assertion validates command-group style help output.
    """

    runner = CliRunner()
    result = runner.invoke(app, ["--help"])

    assert result.exit_code == 0
    assert "open" in result.stdout
    assert "example" in result.stdout


def test_generate_example_creates_showcase_file(tmp_path: Path) -> None:
    """
    Verify the example command writes a markdown showcase file.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate file creation and expected template content.
    """

    output_path = tmp_path / "showcase.md"
    runner = CliRunner()

    result = runner.invoke(app, ["example", str(output_path)])

    assert result.exit_code == 0
    assert output_path.exists()
    assert "Created example file:" in result.stdout

    content = output_path.read_text(encoding="utf-8")
    assert "Markdown-OS Showcase" in content
    assert "```python" in content
    assert "```javascript" in content
    assert "```mermaid" in content


def test_generate_example_appends_filename_for_directory_output(tmp_path: Path) -> None:
    """
    Verify directory output paths create example.md inside that directory.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate directory path normalization behavior.
    """

    output_directory = tmp_path / "docs"
    output_directory.mkdir(parents=True, exist_ok=True)
    expected_file = output_directory / "example.md"
    runner = CliRunner()

    result = runner.invoke(app, ["example", str(output_directory)])

    assert result.exit_code == 0
    assert expected_file.exists()
    assert "Created example file:" in result.stdout


def test_generate_example_declines_overwrite_when_not_forced(tmp_path: Path) -> None:
    """
    Verify overwrite confirmation keeps existing files when declined.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate prompt behavior and unchanged file content.
    """

    output_path = tmp_path / "existing.md"
    output_path.write_text("existing content", encoding="utf-8")
    runner = CliRunner()

    result = runner.invoke(app, ["example", str(output_path)], input="n\n")

    assert result.exit_code == 0
    assert "already exists" in result.stdout
    assert "Cancelled." in result.stdout
    assert output_path.read_text(encoding="utf-8") == "existing content"


def test_generate_example_force_overwrites_without_prompt(tmp_path: Path) -> None:
    """
    Verify the force flag overwrites existing content without prompting.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.

    Returns:
    - None: Assertions validate forced overwrite and refreshed template content.
    """

    output_path = tmp_path / "existing.md"
    output_path.write_text("old content", encoding="utf-8")
    runner = CliRunner()

    result = runner.invoke(app, ["example", str(output_path), "--force"])

    assert result.exit_code == 0
    assert "already exists" not in result.stdout
    assert "Markdown-OS Showcase" in output_path.read_text(encoding="utf-8")


def test_generate_example_open_flag_calls_open_command(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Verify the open flag invokes the open subcommand with generated path.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.
    - monkeypatch (pytest.MonkeyPatch): Fixture used to replace command calls.

    Returns:
    - None: Assertions validate command delegation for --open behavior.
    """

    output_path = tmp_path / "showcase.md"
    call_log: dict[str, object] = {}

    def _fake_open_markdown_file(filepath: Path, host: str, port: int) -> None:
        """
        Capture open command arguments during test execution.

        Args:
        - filepath (Path): Generated markdown path passed by CLI command.
        - host (str): Host option forwarded by command invocation.
        - port (int): Port option forwarded by command invocation.

        Returns:
        - None: Stores filepath in a local call log for assertions.
        """

        call_log["filepath"] = filepath
        call_log["host"] = host
        call_log["port"] = port

    monkeypatch.setattr(cli_module, "open_markdown_file", _fake_open_markdown_file)
    runner = CliRunner()

    result = runner.invoke(app, ["example", str(output_path), "--open"])

    assert result.exit_code == 0
    assert "Opening in editor..." in result.stdout
    assert call_log["filepath"] == output_path.resolve()
    assert call_log["host"] == "127.0.0.1"
    assert call_log["port"] == 8000


def test_generate_example_reports_missing_template(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Verify missing template errors are surfaced clearly to users.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.
    - monkeypatch (pytest.MonkeyPatch): Fixture used to replace template loading.

    Returns:
    - None: Assertions validate exit code and template-missing messaging.
    """

    def _raise_missing_template() -> str:
        """
        Simulate absent packaged template resource during command execution.

        Args:
        - None (None): Raises immediately without receiving inputs.

        Returns:
        - str: Never returns because FileNotFoundError is raised.
        """

        raise FileNotFoundError("missing template")

    monkeypatch.setattr(cli_module, "_load_example_template", _raise_missing_template)
    runner = CliRunner()

    result = runner.invoke(app, ["example", str(tmp_path / "output.md")])

    assert result.exit_code == 1
    assert "Template file is missing" in result.stdout


def test_generate_example_reports_write_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Verify write failures produce a user-friendly command error.

    Args:
    - tmp_path (Path): Pytest-managed temporary directory fixture.
    - monkeypatch (pytest.MonkeyPatch): Fixture used to simulate write failure.

    Returns:
    - None: Assertions validate write-error handling and failure exit code.
    """

    output_path = tmp_path / "cannot-write.md"
    original_write_text = Path.write_text

    def _raise_permission_error(self: Path, *args: object, **kwargs: object) -> int:
        """
        Raise a permission error only for the targeted output file path.

        Args:
        - self (Path): Path instance receiving write_text invocation.
        - args (object): Positional arguments forwarded to the original method.
        - kwargs (object): Keyword arguments forwarded to the original method.

        Returns:
        - int: Character count from the original write operation for other paths.
        """

        if self == output_path.resolve():
            raise PermissionError("permission denied")
        return original_write_text(self, *args, **kwargs)

    monkeypatch.setattr(Path, "write_text", _raise_permission_error)
    runner = CliRunner()

    result = runner.invoke(app, ["example", str(output_path)])

    assert result.exit_code == 1
    assert "Failed to create example file:" in result.stdout
