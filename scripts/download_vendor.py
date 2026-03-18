#!/usr/bin/env python3
"""Download all vendor (CDN) assets for offline/desktop use.

Run from the project root:
    python scripts/download_vendor.py

This downloads JS libraries, CSS stylesheets, and font files into
markdown_os/static/vendor/ so the app works fully offline.
"""

from __future__ import annotations

import hashlib
import urllib.request
from pathlib import Path

VENDOR_DIR = Path(__file__).resolve().parent.parent / "markdown_os" / "static" / "vendor"

# (destination_relative_path, url, expected_sha384_integrity_or_None)
ASSETS: list[tuple[str, str, str | None]] = [
    # --- JavaScript libraries ---
    (
        "js/purify.min.js",
        "https://cdn.jsdelivr.net/npm/dompurify@3.3.1/dist/purify.min.js",
        None,
    ),
    (
        "js/marked.min.js",
        "https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js",
        None,
    ),
    (
        "js/turndown.js",
        "https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.js",
        None,
    ),
    (
        "js/turndown-plugin-gfm.js",
        "https://cdn.jsdelivr.net/npm/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.js",
        None,
    ),
    (
        "js/mermaid.min.js",
        "https://cdn.jsdelivr.net/npm/mermaid@10.9.5/dist/mermaid.min.js",
        None,
    ),
    (
        "js/katex.min.js",
        "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js",
        None,
    ),
    (
        "js/svg-pan-zoom.min.js",
        "https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js",
        None,
    ),
    (
        "js/highlight.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js",
        None,
    ),
    (
        "js/html2pdf.bundle.min.js",
        "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js",
        None,
    ),
    # --- CSS ---
    (
        "css/katex.min.css",
        "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css",
        None,
    ),
    # highlight.js themes
    (
        "css/hljs-github.min.css",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css",
        None,
    ),
    (
        "css/hljs-github-dark.min.css",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css",
        None,
    ),
    (
        "css/hljs-dracula.min.css",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/dracula.min.css",
        None,
    ),
    (
        "css/hljs-nord.min.css",
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/nord.min.css",
        None,
    ),
]

# KaTeX font files referenced by katex.min.css
KATEX_FONT_BASE = "https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/fonts"
KATEX_FONTS = [
    "KaTeX_AMS-Regular.woff2",
    "KaTeX_Caligraphic-Bold.woff2",
    "KaTeX_Caligraphic-Regular.woff2",
    "KaTeX_Fraktur-Bold.woff2",
    "KaTeX_Fraktur-Regular.woff2",
    "KaTeX_Main-Bold.woff2",
    "KaTeX_Main-BoldItalic.woff2",
    "KaTeX_Main-Italic.woff2",
    "KaTeX_Main-Regular.woff2",
    "KaTeX_Math-BoldItalic.woff2",
    "KaTeX_Math-Italic.woff2",
    "KaTeX_SansSerif-Bold.woff2",
    "KaTeX_SansSerif-Italic.woff2",
    "KaTeX_SansSerif-Regular.woff2",
    "KaTeX_Script-Regular.woff2",
    "KaTeX_Size1-Regular.woff2",
    "KaTeX_Size2-Regular.woff2",
    "KaTeX_Size3-Regular.woff2",
    "KaTeX_Size4-Regular.woff2",
    "KaTeX_Typewriter-Regular.woff2",
]


def download(url: str, dest: Path) -> None:
    """Download a single file, creating parent dirs as needed."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        print(f"  skip (exists): {dest.relative_to(VENDOR_DIR)}")
        return
    print(f"  downloading: {dest.relative_to(VENDOR_DIR)}")
    urllib.request.urlretrieve(url, dest)


def patch_katex_css_font_paths(css_path: Path) -> None:
    """Rewrite katex.min.css font URLs to point to local fonts/ directory."""
    content = css_path.read_text(encoding="utf-8")
    # KaTeX CSS references fonts via url(fonts/KaTeX_...) or url(../fonts/...)
    # We need them to point to /static/vendor/fonts/
    content = content.replace("url(fonts/", "url(/static/vendor/fonts/")
    content = content.replace("url(../fonts/", "url(/static/vendor/fonts/")
    css_path.write_text(content, encoding="utf-8")


def main() -> None:
    print(f"Vendor directory: {VENDOR_DIR}\n")

    print("Downloading JS/CSS assets...")
    for rel_path, url, _ in ASSETS:
        download(url, VENDOR_DIR / rel_path)

    print("\nDownloading KaTeX fonts...")
    for font_name in KATEX_FONTS:
        download(f"{KATEX_FONT_BASE}/{font_name}", VENDOR_DIR / "fonts" / font_name)

    print("\nPatching katex.min.css font paths...")
    patch_katex_css_font_paths(VENDOR_DIR / "css" / "katex.min.css")

    print("\nDone! All vendor assets saved to:", VENDOR_DIR)


if __name__ == "__main__":
    main()
