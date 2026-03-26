"""Desktop-specific backend entrypoint for Electron."""

from __future__ import annotations

import signal
import sys

import typer
import uvicorn

from markdown_os.app_runtime import build_editor_app, find_available_port


app = typer.Typer(help="Run the desktop backend runtime for Electron.")


def _print_ready(url: str) -> None:
    """
    Print a machine-readable readiness line for the Electron parent process.

    Args:
    - url (str): Bound local server URL reported after startup.

    Returns:
    - None: The readiness line is emitted to stdout and flushed immediately.
    """

    print(f"MARKDOWN_OS_DESKTOP_READY {url}", flush=True)


def serve_desktop_backend(
    host: str = "127.0.0.1",
    port: int = 8000,
    request_id: str | None = None,
) -> None:
    """
    Start the desktop-aware backend in empty mode for Electron.

    Args:
    - host (str): Loopback host used by the local desktop backend.
    - port (int): Preferred starting port for bind probing.

    Returns:
    - None: Runs the Uvicorn server until the process is terminated.
    """

    _ = request_id
    selected_port = find_available_port(host=host, start_port=port)
    application = build_editor_app(mode="empty", handler=None, desktop=True)
    _print_ready(f"http://{host}:{selected_port}")

    server = uvicorn.Server(
        uvicorn.Config(
            app=application,
            host=host,
            port=selected_port,
            log_level="info",
        )
    )

    def _handle_signal(_signum: int, _frame: object) -> None:
        """
        Request a graceful Uvicorn shutdown from an OS signal handler.

        Args:
        - _signum (int): Signal number received by the process.
        - _frame (object): Python frame object supplied by ``signal``.

        Returns:
        - None: The running server is flagged for normal shutdown.
        """

        server.should_exit = True

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)
    server.run()


@app.command("serve")
def serve_command(
    host: str = typer.Option("127.0.0.1", "--host", help="Loopback host to bind."),
    port: int = typer.Option(
        8000,
        "--port",
        help="Preferred start port; auto-increments when occupied.",
    ),
    request_id: str | None = typer.Option(
        None,
        "--request-id",
        help="Opaque startup identifier forwarded by the Electron parent process.",
    ),
) -> None:
    """
    Expose the desktop backend runtime through the Typer CLI.

    Args:
    - host (str): Loopback host used by the local desktop backend.
    - port (int): Preferred starting port for bind probing.
    - request_id (str | None): Optional startup identifier passed by Electron.

    Returns:
    - None: Delegates to the plain Python runtime entrypoint.
    """

    serve_desktop_backend(host=host, port=port, request_id=request_id)


def run() -> None:
    """
    Execute the desktop-runtime CLI application.

    Args:
    - None (None): Uses process arguments provided by the shell.

    Returns:
    - None: Typer routes to the requested desktop runtime command.
    """

    if len(sys.argv) == 1:
        serve_desktop_backend()
        return

    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        app()
        return

    serve_desktop_backend()


if __name__ == "__main__":
    run()
