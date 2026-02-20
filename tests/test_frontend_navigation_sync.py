"""Regression tests for TOC navigation sync between edit/read modes."""

from pathlib import Path
import re


def _read_static_js(filename: str) -> str:
    """Return the source text for a JS file under markdown_os/static/js."""

    root = Path(__file__).resolve().parents[1]
    return (root / "markdown_os" / "static" / "js" / filename).read_text(encoding="utf-8")


def test_toc_uses_visible_mode_for_click_and_active_updates() -> None:
    """
    Verify TOC interaction depends on the visible pane mode, not stale state.

    This guards the regression where edit-mode TOC behavior could remain bound
    to preview-mode state, breaking click-to-scroll and active link updates.
    """

    source = _read_static_js("toc.js")

    assert "function getCurrentMode()" in source
    assert 'return editorContainer?.classList.contains("active") ? "edit" : "preview";' in source
    assert 'if (getCurrentMode() === "edit") {' in source
    assert 'if (getCurrentMode() !== "preview") {' in source
    assert 'if (getCurrentMode() !== "edit") {' in source


def test_folder_tabs_mode_switch_keeps_heading_position_in_sync() -> None:
    """
    Verify tab-mode edit/read switching synchronizes by active heading index.

    This guards the regression where folder mode skipped heading-based sync and
    TOC updates during mode switches.
    """

    source = _read_static_js("tabs.js")

    assert re.search(
        r'if \(tabName === "edit"\)\s*\{'
        r'[\s\S]*?findActivePreviewHeadingIndex'
        r'[\s\S]*?syncEditorScroll\(activeIndex\)'
        r'[\s\S]*?generateTOC'
        r'[\s\S]*?updateActiveTOCItemForEdit',
        source,
    )
    assert re.search(
        r'tabName !== "preview"'
        r'[\s\S]*?findActiveEditHeadingIndex'
        r'[\s\S]*?syncPreviewScroll\(activeIndex\)'
        r'[\s\S]*?updateActiveTOCItem',
        source,
    )
