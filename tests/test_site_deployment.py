"""Tests for Vercel static deployment layout."""

from __future__ import annotations

import hashlib
from pathlib import Path


def _repo_root() -> Path:
    """Return the repository root path.

    Args:
    - None (None): This helper derives the root from the test file location.

    Returns:
    - Path: Absolute repository root path.
    """

    return Path(__file__).resolve().parents[1]


def _sha256(path: Path) -> str:
    """Return a stable content hash for a file.

    Args:
    - path (Path): File path to hash.

    Returns:
    - str: SHA-256 hex digest for the file bytes.
    """

    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_vercel_site_contains_web_editor_entrypoint() -> None:
    """Verify Vercel output includes the web editor route."""

    root = _repo_root()
    source = root / "markdown_os" / "static" / "index.html"
    deployed = root / "site" / "app" / "index.html"

    assert deployed.is_file()
    source_html = source.read_text(encoding="utf-8")
    deployed_html = deployed.read_text(encoding="utf-8")
    # Web /app injects Google Fonts after fonts.css; everything else matches.
    assert 'href="/static/css/fonts.css"' in deployed_html
    assert "fonts.googleapis.com" in deployed_html
    assert "fonts.googleapis.com" not in source_html
    assert '/static/js/storage-backend.js' in deployed_html
    assert deployed_html.replace(
        '    <link rel="stylesheet" href="/static/css/fonts.css" />\n'
        '    <link rel="preconnect" href="https://fonts.googleapis.com" />\n'
        '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
        "    <link\n"
        '      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"\n'
        '      rel="stylesheet"\n'
        "    />\n",
        '    <link rel="stylesheet" href="/static/css/fonts.css" />\n',
        1,
    ) == source_html


def test_vercel_site_contains_static_editor_assets() -> None:
    """Verify Vercel output has all editor assets under /static."""

    root = _repo_root()
    source_root = root / "markdown_os" / "static"
    deployed_root = root / "site" / "static"
    required_files = [
        Path("favicon.svg"),
        Path("css/fonts.css"),
        Path("css/styles.css"),
        Path("css/themes.css"),
        Path("fonts/inter/inter-latin-400-normal.woff2"),
        Path("js/storage-backend.js"),
        Path("js/editor.js"),
        Path("vendor/marked/marked.min.js"),
        Path("vendor/mermaid/mermaid.min.js"),
    ]

    for relative_path in required_files:
        source = source_root / relative_path
        deployed = deployed_root / relative_path
        assert deployed.is_file(), f"Missing deployed asset: {relative_path}"
        assert _sha256(deployed) == _sha256(source), f"Outdated deployed asset: {relative_path}"


def test_landing_links_to_web_app() -> None:
    """Verify the landing page exposes the deployed web app."""

    index = (_repo_root() / "site" / "index.html").read_text(encoding="utf-8")

    assert 'href="/app"' in index
    assert "Try online" in index


def test_landing_nav_has_try_online_primary_button() -> None:
    """Verify navbar has a right-aligned primary app link."""

    index = (_repo_root() / "site" / "index.html").read_text(encoding="utf-8")

    assert '<nav class="header-nav" aria-label="Primary">' in index
    assert 'class="btn btn-primary header-try-online"' in index
    assert '>Try online</a>' in index
    assert ".header-nav .btn-primary" in index
    assert "color: white" in index.split(".header-nav .btn-primary", 1)[1].split("}", 1)[0]


def test_landing_hero_cta_hierarchy() -> None:
    """Verify hero uses Try online primary, Download secondary, and GitHub tertiary."""

    index = (_repo_root() / "site" / "index.html").read_text(encoding="utf-8")

    hero_section = index.split('<section class="hero">', 1)[1].split('</section>', 1)[0]
    hero_cta = hero_section.split('<div class="hero-cta"', 1)[1].split('<div class="hero-github-row">', 1)[0]
    assert 'href="/app" class="btn btn-primary"' in hero_cta
    assert '>Try online</a>' in hero_cta
    assert 'class="btn btn-secondary download-main-btn"' in hero_cta
    assert 'class="btn btn-secondary download-toggle-btn"' in hero_cta
    assert 'github-tertiary-link' not in hero_cta
    assert '</div>\n                    <div class="hero-github-row">' in hero_section
    assert 'github-tertiary-link' in hero_section
    assert hero_section.index('class="hero-github-row"') > hero_section.index('class="hero-cta"')
    assert 'M10 20.568c-3.429 1.157-6.286 0-8-3.568' in hero_section
    assert 'id="desktop-download-meta"' not in hero_section
    assert 'Native desktop builds' not in hero_section
    assert 'class="install-widget"' not in index
    assert 'install-command' not in index
    assert 'data-tab="uv"' not in index
