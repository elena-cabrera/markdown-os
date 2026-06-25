"""Sync the browser web editor into the Vercel site output."""

from __future__ import annotations

import shutil
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
EDITOR_STATIC_ROOT = REPO_ROOT / "markdown_os" / "static"
SITE_ROOT = REPO_ROOT / "site"
SITE_APP_ROOT = SITE_ROOT / "app"
SITE_STATIC_ROOT = SITE_ROOT / "static"
STATIC_DIRECTORIES = ("css", "fonts", "js", "vendor")
STATIC_FILES = ("favicon.svg",)


def copy_directory(source: Path, destination: Path) -> None:
    """
    Replace a deployed static directory with the current editor assets.

    Args:
    - source (Path): Source directory under ``markdown_os/static``.
    - destination (Path): Destination directory under ``site/static``.

    Returns:
    - None: Destination contents are replaced in place.
    """

    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(source, destination)


def sync_web_editor_site() -> None:
    """
    Copy the shared web editor into the Vercel static output directory.

    Args:
    - None (None): Source and destination paths are repository constants.

    Returns:
    - None: ``site/app`` and ``site/static`` contain deployable editor files.
    """

    SITE_APP_ROOT.mkdir(parents=True, exist_ok=True)
    shutil.copy2(EDITOR_STATIC_ROOT / "index.html", SITE_APP_ROOT / "index.html")

    SITE_STATIC_ROOT.mkdir(parents=True, exist_ok=True)
    for directory_name in STATIC_DIRECTORIES:
        copy_directory(EDITOR_STATIC_ROOT / directory_name, SITE_STATIC_ROOT / directory_name)

    for file_name in STATIC_FILES:
        shutil.copy2(EDITOR_STATIC_ROOT / file_name, SITE_STATIC_ROOT / file_name)


if __name__ == "__main__":
    sync_web_editor_site()
