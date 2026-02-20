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


def test_wysiwyg_supports_markdown_shortcuts_during_typing() -> None:
    """Verify block and inline markdown markers are transformed while typing."""

    source = _read_static_js("wysiwyg.js")

    assert "function applyBlockMarkdownShortcut()" in source
    assert "const headingMatch = blockText.match(/^(#{1,6})\\s+(.*)$/);" in source
    assert "const orderedMatch = blockText.match(/^(\\d+)[.)]\\s+(.*)$/);" in source
    assert "const taskMatch = blockText.match(/^[-*+]\\s+\\[( |x|X)\\]\\s*(.*)$/);" in source
    assert "function applyInlineMarkdownShortcut()" in source
    assert "{ regex: /`([^`\\n]+)`(\\s?)$/, tag: \"code\" }" in source
    assert "event.key === \"*\"" in source
    assert "event.key === \"`\"" in source


def test_wysiwyg_uses_icon_action_buttons_for_edit_and_copy() -> None:
    """Verify edit/copy controls are rendered as shared icon action buttons."""

    source = _read_static_js("wysiwyg.js")

    assert "function createActionButton(kind, title)" in source
    assert "copyButton = createActionButton(\"copy\", \"Copy code\")" in source
    assert "editButton = createActionButton(\"edit\", \"Edit code block\")" in source


def test_wysiwyg_backspace_unwraps_list_item_at_start() -> None:
    """Verify Backspace at list item start exits list mode into a paragraph."""

    source = _read_static_js("wysiwyg.js")

    assert "async function handleRootKeyDown(event)" in source
    assert "event.key !== \"Backspace\"" in source
    assert "function unwrapListItemToParagraph(listItem)" in source
    assert "if (!isRangeAtElementStart(range, listItem))" in source
    assert "placeCaretAtNodeStart(replacementParagraph);" in source


def test_wysiwyg_toolbar_exposes_ctrl_e_inline_code_shortcut() -> None:
    """Verify Ctrl/Cmd+E maps to the inline code command."""

    source = _read_static_js("wysiwyg-toolbar.js")

    assert "else if (key === \"e\")" in source
    assert "await window.wysiwyg.exec(\"inlineCode\")" in source


def test_wysiwyg_inline_code_command_toggles_existing_code() -> None:
    """Verify inline-code command unwraps when selection is already in code."""

    source = _read_static_js("wysiwyg.js")

    assert "function closestCodeElement(node)" in source
    assert "function unwrapCodeElement(codeElement)" in source
    assert "const singleCodeSelection = startCode && endCode && startCode === endCode;" in source
    assert "if (singleCodeSelection) {" in source
