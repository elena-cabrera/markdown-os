"""CLI entrypoint for launching Markdown-OS."""

from __future__ import annotations

import socket
import threading
import webbrowser
from importlib.resources import files
from pathlib import Path

import typer
import uvicorn

from markdown_os.file_handler import FileHandler
from markdown_os.server import create_app

app = typer.Typer(
    help="Open and edit markdown files in a local browser UI.",
    no_args_is_help=True,
)


@app.callback()
def markdown_os() -> None:
    """
    Provide a command group root for Markdown-OS subcommands.

    Args:
    - None (None): This callback receives no positional arguments.

    Returns:
    - None: Callback only exists to preserve explicit subcommands.
    """

    return


def _validate_markdown_file(filepath: Path) -> Path:
    """
    Validate and normalize a markdown path from CLI input.

    Args:
    - filepath (Path): Path supplied by the user from the CLI command.

    Returns:
    - Path: Fully resolved markdown file path when validation passes.
    """

    resolved_path = filepath.expanduser().resolve()
    if not resolved_path.exists():
        raise typer.BadParameter(f"File does not exist: {resolved_path}")
    if not resolved_path.is_file():
        raise typer.BadParameter(f"Path is not a file: {resolved_path}")
    if resolved_path.suffix.lower() not in {".md", ".markdown"}:
        raise typer.BadParameter("Only markdown files are supported (.md, .markdown).")
    return resolved_path


def _is_port_available(host: str, port: int) -> bool:
    """
    Check whether a TCP port can be bound on the given host.

    Args:
    - host (str): Hostname or IP address to test.
    - port (int): TCP port number to verify.

    Returns:
    - bool: True when the host/port pair is free for binding.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def find_available_port(host: str = "127.0.0.1", start_port: int = 8000) -> int:
    """
    Locate the first available port starting from the preferred base port.

    Args:
    - host (str): Host to probe for bind availability.
    - start_port (int): Initial port candidate used for probing.

    Returns:
    - int: Available port that can be used to start the web server.
    """

    if start_port < 1 or start_port > 65535:
        raise typer.BadParameter("Start port must be between 1 and 65535.")

    for candidate_port in range(start_port, 65536):
        if _is_port_available(host=host, port=candidate_port):
            return candidate_port

    raise typer.BadParameter("No available TCP port found in range 8000-65535.")


def _open_browser(url: str) -> None:
    """
    Open the editor URL in the default browser asynchronously.

    Args:
    - url (str): Fully qualified URL to open in the user's browser.

    Returns:
    - None: Browser open is dispatched in a background timer thread.
    """

    timer = threading.Timer(0.4, lambda: webbrowser.open(url, new=2, autoraise=True))
    timer.daemon = True
    timer.start()


def _resolve_example_output_path(output: Path) -> Path:
    """
    Normalize the example output argument into a final markdown file path.

    Args:
    - output (Path): User-provided output argument from the CLI command.

    Returns:
    - Path: Resolved file path where the example markdown will be written.
    """

    expanded_output = output.expanduser()
    if expanded_output.exists() and expanded_output.is_dir():
        expanded_output = expanded_output / "example.md"
    return expanded_output.resolve()


def _load_example_template() -> str:
    """
    Read the bundled showcase template used by the example command.

    Args:
    - None (None): Template location is fixed within package resources.

    Returns:
    - str: UTF-8 markdown content loaded from the bundled template file.
    """

    template_resource = files("markdown_os").joinpath("templates", "example_template.md")
    return template_resource.read_text(encoding="utf-8")


@app.command("open")
def open_markdown_file(
    filepath: Path = typer.Argument(..., help="Path to a .md file."),
    host: str = typer.Option("127.0.0.1", "--host", help="Host interface to bind."),
    port: int = typer.Option(
        8000, "--port", help="Preferred start port; auto-increments when occupied."
    ),
) -> None:
    """
    Start a local web editor for the provided markdown file.

    Args:
    - filepath (Path): Markdown file path to open in the editor.
    - host (str): Host interface used by the FastAPI/Uvicorn server.
    - port (int): Preferred start port for auto-increment probing.

    Returns:
    - None: Function starts a blocking uvicorn server until interrupted.
    """

    resolved_path = _validate_markdown_file(filepath)
    selected_port = find_available_port(host=host, start_port=port)
    editor_url = f"http://{host}:{selected_port}"

    typer.echo(f"Opening {resolved_path} at {editor_url}")
    _open_browser(editor_url)

    file_handler = FileHandler(resolved_path)
    application = create_app(file_handler)
    uvicorn.run(application, host=host, port=selected_port)


@app.command("example")
def generate_example(
    output: Path = typer.Argument(
        Path("example.md"),
        help="Output path for the generated showcase markdown file.",
    ),
    open_after: bool = typer.Option(
        False,
        "--open",
        help="Open the generated example file in the editor after creation.",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Overwrite an existing file without prompting.",
    ),
) -> None:
    """
    Generate a showcase markdown file that demonstrates Markdown-OS features.

    Args:
    - output (Path): Destination path for the generated markdown example.
    - open_after (bool): Whether to launch the local editor after writing output.
    - force (bool): Whether to skip overwrite confirmation for existing files.

    Returns:
    - None: Writes a markdown file and optionally launches the editor command.
    """

    resolved_output = _resolve_example_output_path(output)

    if resolved_output.exists() and not force:
        overwrite = typer.confirm(
            f"File {resolved_output} already exists. Overwrite?",
            default=False,
        )
        if not overwrite:
            typer.echo("Cancelled.")
            raise typer.Exit(code=0)

    try:
        resolved_output.parent.mkdir(parents=True, exist_ok=True)
        template_content = _load_example_template()
        resolved_output.write_text(template_content, encoding="utf-8")
    except (FileNotFoundError, ModuleNotFoundError):
        typer.secho(
            "Template file is missing. Expected markdown_os/templates/example_template.md.",
            fg=typer.colors.RED,
        )
        raise typer.Exit(code=1) from None
    except OSError as error:
        typer.secho(f"Failed to create example file: {error}", fg=typer.colors.RED)
        raise typer.Exit(code=1) from error

    typer.secho(f"Created example file: {resolved_output}", fg=typer.colors.GREEN)
    typer.echo("Next step:")
    typer.echo(f"  markdown-os open {resolved_output}")

    if open_after:
        typer.echo("Opening in editor...")
        open_markdown_file(filepath=resolved_output)


def run() -> None:
    """
    Execute the Typer CLI application.

    Args:
    - None (None): Uses process arguments provided by the shell.

    Returns:
    - None: The Typer app handles command routing and execution.
    """

    app()


if __name__ == "__main__":
    run()
