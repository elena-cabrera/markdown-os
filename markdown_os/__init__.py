"""Markdown-OS package."""

from importlib.metadata import PackageNotFoundError, version

from markdown_os.cli import app

try:
    __version__ = version("markdown-os")
except PackageNotFoundError:
    __version__ = "0.0.0-dev"

__all__ = ["__version__", "app"]
