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

# Web /app is online-only; load Inter from Google Fonts in addition to the
# self-hosted woff2 files so the editor never falls through to generic
# sans-serif when local @font-face fails to apply.
WEB_APP_GOOGLE_FONTS_LINKS = """    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
      rel="stylesheet"
    />
"""


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


def inject_web_app_google_fonts(index_html: Path) -> None:
    """
    Insert Google Fonts stylesheet links into the web editor HTML.

    Args:
    - index_html (Path): Path to ``site/app/index.html`` after it is copied
      from the shared editor template.

    Returns:
    - None: The HTML file is updated in place when the fonts marker is found.
    """

    html = index_html.read_text(encoding="utf-8")
    marker = '    <link rel="stylesheet" href="/static/css/fonts.css" />\n'
    if marker not in html:
        raise ValueError(f"Could not find fonts.css link marker in {index_html}")
    if "fonts.googleapis.com" in html:
        return
    index_html.write_text(
        html.replace(marker, marker + WEB_APP_GOOGLE_FONTS_LINKS, 1),
        encoding="utf-8",
    )


def sync_web_editor_site() -> None:
    """
    Copy the shared web editor into the Vercel static output directory.

    Args:
    - None (None): Source and destination paths are repository constants.

    Returns:
    - None: ``site/app`` and ``site/static`` contain deployable editor files.
    """

    SITE_APP_ROOT.mkdir(parents=True, exist_ok=True)
    app_index = SITE_APP_ROOT / "index.html"
    shutil.copy2(EDITOR_STATIC_ROOT / "index.html", app_index)
    inject_web_app_google_fonts(app_index)

    SITE_STATIC_ROOT.mkdir(parents=True, exist_ok=True)
    for directory_name in STATIC_DIRECTORIES:
        copy_directory(EDITOR_STATIC_ROOT / directory_name, SITE_STATIC_ROOT / directory_name)

    for file_name in STATIC_FILES:
        shutil.copy2(EDITOR_STATIC_ROOT / file_name, SITE_STATIC_ROOT / file_name)


if __name__ == "__main__":
    sync_web_editor_site()
