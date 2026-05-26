"""Regression tests for unified WYSIWYG TOC and folder tab synchronization."""

from pathlib import Path


def _read_static_js(filename: str) -> str:
    """Return the source text for a JS file under markdown_os/static/js."""

    root = Path(__file__).resolve().parents[1]
    return (root / "markdown_os" / "static" / "js" / filename).read_text(encoding="utf-8")


def _read_static_css(filename: str) -> str:
    """Return the source text for a CSS file under markdown_os/static/css."""

    root = Path(__file__).resolve().parents[1]
    return (root / "markdown_os" / "static" / "css" / filename).read_text(encoding="utf-8")


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


def test_static_shell_loads_storage_backend_before_runtime_modules() -> None:
    """Verify the storage adapter is available before websocket and editor modules."""

    html_source = Path(__file__).resolve().parents[1].joinpath(
        "markdown_os",
        "static",
        "index.html",
    ).read_text(encoding="utf-8")

    storage_index = html_source.index('/static/js/storage-backend.js')
    websocket_index = html_source.index('/static/js/websocket.js')
    editor_index = html_source.index('/static/js/editor.js')

    assert storage_index < websocket_index
    assert storage_index < editor_index


def test_web_storage_backend_supports_static_browser_workspace() -> None:
    """Verify web runtime persistence is implemented behind a shared adapter."""

    source = _read_static_js("storage-backend.js")

    assert "const WEB_DATABASE_NAME = \"markdown-os-web\";" in source
    assert "function createHttpStorageBackend" in source
    assert "function createIndexedDbStorageBackend" in source
    assert "async function detectMode()" in source
    assert "window.MarkdownOS.storage" in source
    assert "Welcome.md" in source
    assert "FileReader" in source


def test_web_storage_backend_does_not_cache_http_runtime_mode() -> None:
    """Verify desktop workspace changes can refresh mode after empty startup."""

    source = _read_static_js("storage-backend.js")

    assert "let detectedModePromise" not in source
    assert "async function detectMode() {\n    return readServerMode();\n  }" in source
    assert "const mode = await detectMode();" in source


def test_web_storage_backend_checks_browser_file_conflicts() -> None:
    """Verify web mode compares stored content before overwriting open tabs."""

    source = _read_static_js("storage-backend.js")

    assert "async checkForExternalChanges(filePath, lastSavedContent) {" in source
    assert 'return (record?.content || "") !== lastSavedContent;' in source


def test_web_storage_backend_rename_keeps_files_markdown_visible() -> None:
    """Verify web file rename cannot hide markdown records from the file tree."""

    source = _read_static_js("storage-backend.js")

    assert "if (isSingleFileRename && !isMarkdownPath(newPath)) {" in source
    assert 'throw new Error("Web workspace files must end with .md or .markdown.");' in source


def test_shared_frontend_modules_delegate_to_storage_backend() -> None:
    """Verify editor, tabs, and file tree use the storage adapter for persistence."""

    editor_source = _read_static_js("editor.js")
    tabs_source = _read_static_js("tabs.js")
    file_tree_source = _read_static_js("file-tree.js")
    websocket_source = _read_static_js("websocket.js")

    assert "window.MarkdownOS?.storage?.detectMode" in editor_source
    assert "window.MarkdownOS?.storage?.getContent" in editor_source
    assert "window.MarkdownOS?.storage?.saveContent" in editor_source
    assert "window.MarkdownOS?.storage?.uploadImage" in editor_source
    assert "mode === \"folder\" || mode === \"web\"" in editor_source

    assert "window.MarkdownOS?.storage?.getContent" in tabs_source
    assert "window.MarkdownOS?.storage?.saveContent" in tabs_source
    assert "mode === \"folder\" || mode === \"web\"" in tabs_source

    assert "window.MarkdownOS?.storage?.getFileTree" in file_tree_source
    assert "window.MarkdownOS?.storage?.createFile" in file_tree_source
    assert "window.MarkdownOS?.storage?.renamePath" in file_tree_source
    assert "window.MarkdownOS?.storage?.deletePath" in file_tree_source
    assert "mode === \"folder\" || mode === \"web\"" in file_tree_source

    assert "mode === \"web\"" in websocket_source


def test_folder_mode_sidebar_can_be_collapsed_and_restored() -> None:
    """Verify folder mode exposes whole-sidebar collapse and restore controls."""

    html_source = Path(__file__).resolve().parents[1].joinpath(
        "markdown_os",
        "static",
        "index.html",
    ).read_text(encoding="utf-8")
    js_source = _read_static_js("file-tree.js")
    css_source = _read_static_css("styles.css")

    assert 'id="sidebar-toggle-button"' in html_source
    assert 'const SIDEBAR_COLLAPSE_KEY = "markdown-os-sidebar-collapsed";' in js_source
    assert 'appContainer.classList.toggle("sidebar-collapsed", collapsed);' in js_source
    assert 'const toggleButton = document.getElementById("sidebar-toggle-button");' in js_source
    assert 'document.getElementById("sidebar-toggle-button")?.classList.remove("hidden");' in js_source
    assert "function sidebarToggleIconSvg(collapsed)" in js_source
    assert "toggleButton.innerHTML = sidebarToggleIconSvg(collapsed);" in js_source
    assert 'toggleSidebarCollapse' in js_source
    assert ".container.sidebar-collapsed #sidebar {" in css_source


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


def test_wysiwyg_restores_editable_body_for_empty_documents() -> None:
    """Verify empty documents still render an editable paragraph after frontmatter UI."""

    source = _read_static_js("wysiwyg.js")

    assert "function ensureEditableBody()" in source
    assert "node.matches(\".frontmatter-properties, .frontmatter-properties-create\")" in source
    assert "paragraph.appendChild(document.createElement(\"br\"));" in source
    assert "refreshFrontmatterPanel();\n    ensureEditableBody();" in source


def test_wysiwyg_uses_icon_action_buttons_for_edit_and_copy() -> None:
    """Verify edit/copy controls are rendered as shared icon action buttons."""

    source = _read_static_js("wysiwyg.js")

    assert "function createActionButton(kind, title)" in source
    assert "copyButton = createActionButton(\"copy\", \"Copy code\")" in source
    assert "editButton = createActionButton(\"edit\", \"Edit code block\")" in source
    assert "button.innerHTML = actionIconSvg(\"check\")" in source


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


def test_wysiwyg_mermaid_fullscreen_shows_loading_state() -> None:
    """Verify Mermaid fullscreen opens with a loading spinner before SVG render."""

    source = _read_static_js("wysiwyg.js")

    assert "mermaid-fullscreen-loading" in source
    assert "content-loading-spinner" in source
    assert "fit: true" in source


def test_wysiwyg_links_support_open_and_edit_click_paths() -> None:
    """Verify links can open in new tab and be edited from click handling."""

    source = _read_static_js("wysiwyg.js")

    assert "function editLinkElement(linkElement)" in source
    assert "if (event.metaKey || event.ctrlKey)" in source
    assert "openLinkInNewTab(link);" in source
    assert "editLinkElement(link);" in source


def test_wysiwyg_mermaid_canvas_click_no_longer_opens_editor() -> None:
    """Verify Mermaid block clicks do not trigger click-to-edit modal."""

    source = _read_static_js("wysiwyg.js")

    assert 'event.target.closest("button, input")' in source
    assert 'block.classList.contains("mermaid-container")' not in source


def test_wysiwyg_modifier_key_updates_link_cursor_state() -> None:
    """Verify Cmd/Ctrl key state toggles link-open cursor mode."""

    source = _read_static_js("wysiwyg.js")

    assert "function setLinkModifierCursorState(isActive)" in source
    assert "document.documentElement.classList.toggle" in source
    assert '"link-open-modifier"' in source
    assert "function bindModifierLinkCursorState()" in source
    assert "document.addEventListener(\"keydown\", handleModifierKeyState);" in source


def test_wysiwyg_mermaid_reset_uses_svg_icon() -> None:
    """Verify Mermaid reset controls use the SVG reset icon helper."""

    source = _read_static_js("wysiwyg.js")

    assert "if (kind === \"reset\")" in source
    assert "reset.innerHTML = actionIconSvg(\"reset\")" in source


def test_frontend_uses_custom_dialogs_instead_of_native_prompt_confirm() -> None:
    """Verify editor surfaces no longer call native prompt/confirm dialogs."""

    for filename in ("wysiwyg.js", "editor.js", "tabs.js"):
        source = _read_static_js(filename)
        assert "window.prompt(" not in source
        assert "window.confirm(" not in source


def test_wysiwyg_mermaid_uses_inline_toolbar_for_action_buttons() -> None:
    """Verify Mermaid action buttons are placed in dedicated inline toolbar."""

    source = _read_static_js("wysiwyg.js")

    assert "let toolbar = container.querySelector(\".mermaid-inline-toolbar\");" in source
    assert "toolbar.className = \"mermaid-inline-toolbar\";" in source
    assert "toolbar.appendChild(editButton);" in source
    assert "toolbar.appendChild(fullscreenButton);" in source


def test_wysiwyg_normalizes_flowchart_braces_in_square_bracket_labels() -> None:
    """Verify API path braces in flowchart nodes are quoted before Mermaid render."""

    source = _read_static_js("wysiwyg.js")

    assert "function normalizeMermaidSource(source)" in source
    assert "/^(flowchart|graph)(\\s|$)/i.test(firstLine.trim())" in source
    assert "await window.mermaid.render(" in source
    assert "function renderMermaidContainer(container)" in source


def test_wysiwyg_mermaid_renders_each_diagram_independently() -> None:
    """Verify one invalid diagram does not force errors on every Mermaid block."""

    source = _read_static_js("wysiwyg.js")

    assert "for (const container of containers)" in source
    assert "await renderMermaidContainer(container)" in source
    assert "renderMermaidError(container, rawSource)" in source


def test_wysiwyg_inline_code_has_background_highlight() -> None:
    """Verify inline code uses a subtle background without a custom text color."""

    styles = _read_static_css("styles.css")

    assert "--inline-code-bg:" in styles
    assert "#wysiwyg-editor :not(pre) > code" in styles
    assert "border-radius: 4px" in styles
    assert "color: inherit" in styles.split("#wysiwyg-editor :not(pre) > code", 1)[1]


def test_wysiwyg_mermaid_inline_uses_layout_not_panzoom() -> None:
    """Verify inline diagrams are sized for preview instead of svg-pan-zoom."""

    source = _read_static_js("wysiwyg.js")
    styles = _read_static_css("styles.css")

    assert "function layoutMermaidDiagram(container)" in source
    assert "function applyInlineMermaidZoom(container, factor)" in source
    assert "function applyZoomToDiagrams" not in source
    assert ".mermaid-canvas {" in styles
    assert "overflow: auto" in styles.split(".mermaid-canvas {", 1)[1]
    canvas_svg_rule = styles.split(".mermaid-canvas svg {", 1)[1].split("}", 1)[0]
    assert "width: 100% !important" not in canvas_svg_rule


def test_wysiwyg_mermaid_toolbar_is_separate_from_canvas_layer() -> None:
    """Verify Mermaid controls are outside the zoomable canvas layer."""

    source = _read_static_js("wysiwyg.js")
    styles = _read_static_css("styles.css")

    assert "function ensureMermaidCanvas(container)" in source
    assert "canvas.className = \"mermaid-canvas\";" in source
    assert "container.insertBefore(toolbar, canvas);" in source
    assert "canvas.appendChild(controls);" in source
    assert ".mermaid-canvas svg" in styles
    assert ".mermaid-container svg {" not in styles


def test_dialogs_restore_editor_scroll_after_modal_close() -> None:
    """Verify dialog close paths preserve editor scroll and avoid focus scrolling."""

    dialogs_source = _read_static_js("dialogs.js")
    editor_source = _read_static_js("editor.js")
    tabs_source = _read_static_js("tabs.js")

    shared_utils_source = _read_static_js("shared-utils.js")
    assert "function captureEditorScrollTop()" in dialogs_source
    assert "function restoreEditorScrollTop(scrollTop)" in dialogs_source
    assert "element.focus({ preventScroll: true })" in shared_utils_source
    assert "focusWithoutScroll" in dialogs_source
    assert "window.wysiwyg?.setScrollTop?.(previousScrollTop);" in editor_source
    assert "window.wysiwyg?.setScrollTop?.(previousScrollTop);" in tabs_source
