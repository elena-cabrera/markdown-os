"""Download vendored frontend assets for offline editor builds."""

from __future__ import annotations

import re
import urllib.request
from pathlib import Path
from urllib.parse import urljoin

ASSET_URLS: list[tuple[str, str]] = [
    (
        "markdown_os/static/vendor/katex/katex.min.css",
        "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css",
    ),
    (
        "markdown_os/static/vendor/katex/katex.min.js",
        "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js",
    ),
    (
        "markdown_os/static/vendor/dompurify/purify.min.js",
        "https://cdn.jsdelivr.net/npm/dompurify@3.3.1/dist/purify.min.js",
    ),
    (
        "markdown_os/static/vendor/marked/marked.min.js",
        "https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js",
    ),
    (
        "markdown_os/static/vendor/turndown/turndown.js",
        "https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.js",
    ),
    (
        "markdown_os/static/vendor/turndown-plugin-gfm/turndown-plugin-gfm.js",
        "https://cdn.jsdelivr.net/npm/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.js",
    ),
    (
        "markdown_os/static/vendor/mermaid/mermaid.min.js",
        "https://cdn.jsdelivr.net/npm/mermaid@10.9.5/dist/mermaid.min.js",
    ),
    (
        "markdown_os/static/vendor/svg-pan-zoom/svg-pan-zoom.min.js",
        "https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js",
    ),
    (
        "markdown_os/static/vendor/highlightjs/highlight.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js",
    ),
    (
        "markdown_os/static/vendor/highlightjs/styles/github.min.css",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css",
    ),
    (
        "markdown_os/static/vendor/highlightjs/styles/github-dark.min.css",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css",
    ),
    (
        "markdown_os/static/vendor/highlightjs/styles/base16/dracula.min.css",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/dracula.min.css",
    ),
    (
        "markdown_os/static/vendor/highlightjs/styles/nord.min.css",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/nord.min.css",
    ),
    (
        "markdown_os/static/vendor/highlightjs/styles/grayscale.min.css",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/grayscale.min.css",
    ),
    (
        "markdown_os/static/vendor/html2pdf/html2pdf.bundle.min.js",
        "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js",
    ),
]

CSS_URL_PATTERN = re.compile(r"url\((?P<quote>['\"]?)(?P<url>[^)'\"]+)(?P=quote)\)")


def workspace_root() -> Path:
    """
    Return the repository root that contains vendored asset directories.

    Args:
    - None (None): The root is derived from this script's location.

    Returns:
    - Path: Absolute repository root path.
    """

    return Path(__file__).resolve().parent.parent


def download_text(url: str) -> str:
    """
    Download UTF-8 text content from a remote URL.

    Args:
    - url (str): Fully qualified asset URL to download.

    Returns:
    - str: Decoded response body.
    """

    with urllib.request.urlopen(url) as response:
        return response.read().decode("utf-8")


def download_binary(url: str) -> bytes:
    """
    Download raw binary content from a remote URL.

    Args:
    - url (str): Fully qualified asset URL to download.

    Returns:
    - bytes: Response bytes exactly as served by the remote host.
    """

    with urllib.request.urlopen(url) as response:
        return response.read()


def write_binary(path: Path, content: bytes) -> None:
    """
    Write binary content to disk, creating parent directories as needed.

    Args:
    - path (Path): Absolute file path to write.
    - content (bytes): Binary payload to persist.

    Returns:
    - None: File is created or replaced on disk.
    """

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def write_text(path: Path, content: str) -> None:
    """
    Write UTF-8 text content to disk, creating parent directories as needed.

    Args:
    - path (Path): Absolute file path to write.
    - content (str): Text payload to persist.

    Returns:
    - None: File is created or replaced on disk.
    """

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def extract_relative_css_assets(css_content: str) -> list[str]:
    """
    Extract relative asset URLs referenced by a downloaded stylesheet.

    Args:
    - css_content (str): CSS source content to inspect.

    Returns:
    - list[str]: Relative URL strings referenced by ``url(...)`` declarations.
    """

    relative_assets: list[str] = []
    for match in CSS_URL_PATTERN.finditer(css_content):
        asset_url = match.group("url").strip()
        if asset_url.startswith(("data:", "http://", "https://")):
            continue
        relative_assets.append(asset_url)
    return relative_assets


def download_asset(target_relative_path: str, source_url: str) -> None:
    """
    Download a single asset into the repository vendor directory.

    Args:
    - target_relative_path (str): Repository-relative path where the asset should be written.
    - source_url (str): Remote URL used to fetch the asset.

    Returns:
    - None: The requested asset is written to disk.
    """

    target_path = workspace_root() / target_relative_path
    write_binary(target_path, download_binary(source_url))


def sync_katex_assets() -> None:
    """
    Download KaTeX CSS and every relative font asset it references.

    Args:
    - None (None): Uses the configured KaTeX stylesheet URL from ``ASSET_URLS``.

    Returns:
    - None: KaTeX stylesheet and referenced font files are written locally.
    """

    css_target = workspace_root() / "markdown_os/static/vendor/katex/katex.min.css"
    css_source = "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css"
    css_content = download_text(css_source)
    write_text(css_target, css_content)

    for relative_asset in extract_relative_css_assets(css_content):
        asset_url = urljoin(css_source, relative_asset)
        asset_target = css_target.parent / relative_asset
        write_binary(asset_target, download_binary(asset_url))


def main() -> None:
    """
    Download every configured vendor asset needed for offline editor usage.

    Args:
    - None (None): Uses the static asset manifest declared in this module.

    Returns:
    - None: All configured assets are downloaded into ``markdown_os/static/vendor``.
    """

    sync_katex_assets()
    for target_relative_path, source_url in ASSET_URLS:
        if target_relative_path == "markdown_os/static/vendor/katex/katex.min.css":
            continue
        download_asset(target_relative_path, source_url)
        print(f"Downloaded {target_relative_path}")


if __name__ == "__main__":
    main()
