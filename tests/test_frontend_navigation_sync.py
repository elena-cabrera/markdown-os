"""Regression tests for unified WYSIWYG TOC and folder tab synchronization."""

from pathlib import Path


def _read_static_js(filename: str) -> str:
    """Return the source text for a JS file under markdown_os/static/js."""

    root = Path(__file__).resolve().parents[1]
    return (root / "markdown_os" / "static" / "js" / filename).read_text(encoding="utf-8")


def test_toc_reads_wysiwyg_headings_and_scrolls_editor() -> None:
    """Verify TOC is derived from the unified WYSIWYG heading DOM."""

    source = _read_static_js("toc.js")

    assert "window.wysiwyg?.getHeadingElements?.()" in source
    assert "window.wysiwyg?.scrollHeadingIntoView?.(targetId)" in source
    assert "findActiveHeadingIndex" in source
    assert "editor-container" in source


def test_folder_tabs_use_wysiwyg_markdown_and_scroll_state() -> None:
    """Verify tab state and switching use WYSIWYG markdown and a single scroll surface."""

    source = _read_static_js("tabs.js")

    assert "window.wysiwyg?.getMarkdown?.()" in source
    assert "window.wysiwyg?.setMarkdown?.(tabData.content, { silent: true })" in source
    assert "window.wysiwyg?.setScrollTop?.(tabData.scrollTop)" in source
    assert "setActiveMode" not in source
