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


def test_web_mode_exposes_markdown_download_button() -> None:
    """Verify web mode has a Download button before Options for current markdown."""

    root = Path(__file__).resolve().parents[1]
    html_source = root.joinpath("markdown_os", "static", "index.html").read_text(encoding="utf-8")
    editor_source = _read_static_js("editor.js")
    css_source = _read_static_css("styles.css")

    download_index = html_source.index('id="web-download-button"')
    options_index = html_source.index('id="quick-actions-menu"')
    assert download_index < options_index
    assert 'class="quick-actions-toggle web-download-button hidden"' in html_source
    assert 'M3 17c0 .93 0 1.395.102 1.777' in html_source
    assert '<span>Download</span>' in html_source[download_index:options_index]

    assert "function updateWebDownloadButton()" in editor_source
    assert 'downloadButton.classList.toggle("hidden", editorState.mode !== "web");' in editor_source
    assert "function downloadCurrentMarkdown()" in editor_source
    assert 'new Blob([currentMarkdown()], { type: "text/markdown;charset=utf-8" })' in editor_source
    assert 'document.getElementById("web-download-button")?.addEventListener("click", downloadCurrentMarkdown);' in editor_source
    assert ".web-download-button svg" in css_source


def test_web_open_button_imports_markdown_files() -> None:
    """Verify web mode Open uses a browser file picker import flow."""

    source = _read_static_js("file-tree.js")

    assert "async function handleWebFileImport()" in source
    assert 'input.type = "file";' in source
    assert 'input.accept = ".md,.markdown,text/markdown,text/plain";' in source
    assert "await importAndOpenFiles(() => window.MarkdownOS?.storage?.importFiles?.(input.files));" in source
    assert 'if (fileTreeState.mode === "web") {' in source
    assert "await handleWebFileImport();" in source
    assert 'label.textContent = fileTreeState.mode === "web" ? "Import" : "Open";' in source


def test_web_storage_backend_imports_markdown_files() -> None:
    """Verify IndexedDB backend can import selected markdown files."""

    source = _read_static_js("storage-backend.js")

    assert "async function importBrowserFiles(fileList)" in source
    assert "await file.text()" in source
    assert "await writeRecord(targetPath, content, {" in source
    assert "return { paths };" in source
    assert "async importFiles(fileList)" in source


def test_drag_drop_uses_whole_app_overlay() -> None:
    """Verify file drag feedback covers the whole app with icon and copy."""

    root = Path(__file__).resolve().parents[1]
    html_source = root.joinpath("markdown_os", "static", "index.html").read_text(encoding="utf-8")
    css_source = _read_static_css("styles.css")
    editor_source = _read_static_js("editor.js")

    assert 'id="drop-file-overlay"' in html_source
    assert 'class="drop-file-overlay hidden"' in html_source
    assert 'Drop File' in html_source
    assert 'M4 12v2.544' in html_source

    assert ".drop-file-overlay {" in css_source
    assert "position: fixed" in css_source.split(".drop-file-overlay {", 1)[1]
    assert "inset: 24px" in css_source.split(".drop-file-overlay {", 1)[1]
    assert "border: 2px dashed var(--accent)" in css_source
    assert ".drop-file-card" in css_source

    assert 'const overlay = document.getElementById("drop-file-overlay");' in editor_source
    assert 'overlay?.classList.toggle("hidden", !isActive);' in editor_source
    assert 'document.body.classList.toggle("file-drop-active", isActive);' in editor_source
    assert 'document.getElementById("editor-container")?.classList.toggle("drag-over", isActive);' not in editor_source


def test_markdown_files_can_be_imported_by_drag_and_drop() -> None:
    """Verify markdown drops import files before image-drop handling."""

    source = _read_static_js("editor.js")

    assert "function isMarkdownImportFile(file)" in source
    assert "async function handleMarkdownFileImport(fileList)" in source
    assert "const markdownFiles = markdownFilesFromFileList(files);" in source
    assert "await handleMarkdownFileImport(markdownFiles);" in source
    assert 'setSaveStatus(payload?.readOnly ? "Browser copy only" : "Markdown imported", "saved");' in source
    assert "function bindMarkdownDropEvents()" in source
    assert 'document.addEventListener("dragenter", handleMarkdownDragOver, true);' in source
    assert 'document.addEventListener("dragover", handleMarkdownDragOver, true);' in source
    assert 'document.addEventListener("drop", handleMarkdownDrop, true);' in source


def test_http_storage_backend_imports_markdown_into_folder_workspace() -> None:
    """Verify local folder/desktop workspace imports use existing HTTP file APIs."""

    source = _read_static_js("storage-backend.js")

    assert "async function importFilesToHttpWorkspace(fileList)" in source
    assert "const content = await file.text();" in source
    assert "await this.createFile(targetPath);" in source
    assert "await this.saveContent(content, targetPath);" in source
    assert "return { paths };" in source


def test_file_tree_exposes_open_imported_path_helper() -> None:
    """Verify drag/drop import can open the first imported workspace file."""

    source = _read_static_js("file-tree.js")

    assert "async function openImportedPath(payload)" in source
    assert "const importedPath = payload?.paths?.[0];" in source
    assert "await window.fileTabs.openTab(importedPath, { skipCurrentSave: true });" in source
    assert "openImportedPath," in source


def test_import_open_skips_blocking_save_on_previous_tab() -> None:
    """Verify import switches tabs without blocking on the previous tab save."""

    tabs_source = _read_static_js("tabs.js")

    assert "async function openTab(filePath, options = {})" in tabs_source
    assert "return switchTab(filePath, options);" in tabs_source
    assert "if (currentTab) {" in tabs_source
    assert "saveCurrentTabState(currentPath);" in tabs_source
    assert "if (!skipCurrentSave && currentTab.isDirty)" in tabs_source
    assert "return window.saveStatusForPayload(payload);" in tabs_source


def test_web_storage_marks_imported_files_editable_in_browser() -> None:
    """Verify imported files are stored as editable browser workspace files."""

    source = _read_static_js("storage-backend.js")

    assert 'storage_status: record.storageStatus || "browser"' in source
    assert 'storageStatus: "browser"' in source
    assert 'read_only: record.readOnly === true' in source
    assert "readOnly: false" in source
    assert 'return { paths, readOnly: false };' in source


def test_web_storage_uses_browser_storage_not_file_sync() -> None:
    """Verify online mode does not expose real-file sync metadata or write handles."""

    source = _read_static_js("storage-backend.js")

    assert "sync_status" not in source
    assert "syncStatus" not in source
    assert '"synced"' not in source
    assert "createWritable" not in source
    assert "writeFileHandle" not in source
    assert "storage_status" in source

def test_web_editor_uses_browser_storage_status_labels() -> None:
    """Verify online mode status text does not claim file sync."""

    editor_source = _read_static_js("editor.js")
    tabs_source = _read_static_js("tabs.js")

    assert "function saveStatusForPayload(payload)" in editor_source
    assert 'return "Stored in browser";' in editor_source
    assert "Synced to file" not in editor_source
    assert 'setSaveStatus(saveStatusForPayload(responsePayload), "saved");' in editor_source
    assert 'setSaveStatus(saveStatusForPayload(payload), "saved");' in tabs_source
    assert 'setSaveStatus(activeTab?.readOnly ? "Browser copy only" : "Loaded", "saved");' in tabs_source


def test_web_read_only_metadata_still_disables_editing() -> None:
    """Verify files marked read-only in metadata stay non-editable."""

    editor_source = _read_static_js("editor.js")

    assert "function setEditorReadOnly(isReadOnly)" in editor_source
    assert "editorState.isReadOnly = Boolean(isReadOnly);" in editor_source
    assert 'setSaveStatus("Browser copy only", "neutral");' in editor_source
    assert "if (editorState.isReadOnly)" in editor_source


def test_web_import_button_uses_file_handles_for_read_only_imports_when_available() -> None:
    """Verify web Import can read file handles without claiming file sync."""

    file_tree_source = _read_static_js("file-tree.js")
    storage_source = _read_static_js("storage-backend.js")

    assert "window.showOpenFilePicker" in file_tree_source
    assert "await window.showOpenFilePicker({" in file_tree_source
    assert "await window.MarkdownOS?.storage?.importFileHandles?.(fileHandles);" in file_tree_source
    assert "async importFileHandles(fileHandles)" in storage_source
    assert "const file = await fileHandle.getFile();" in storage_source
    assert "createWritable" not in storage_source


def test_drag_drop_uses_file_system_handles_when_available() -> None:
    """Verify drag/drop tries writable file handles before read-only file snapshots."""

    editor_source = _read_static_js("editor.js")
    storage_source = _read_static_js("storage-backend.js")

    assert "await window.MarkdownOS?.storage?.importDataTransferItems?.(event.dataTransfer?.items);" in editor_source
    assert "async importDataTransferItems(items)" in storage_source
    assert "await item.getAsFileSystemHandle()" in storage_source
    assert "await importFileWithOptionalHandle(file, fileHandle);" in storage_source


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
    assert "window.sharedUtils?.ensureMarkdownExtension?.(rawPath)" in file_tree_source
    assert "window.MarkdownOS?.storage?.renamePath" in file_tree_source
    assert "window.MarkdownOS?.storage?.deletePath" in file_tree_source
    assert "mode === \"folder\" || mode === \"web\"" in file_tree_source

    assert "mode === \"web\"" in websocket_source


def test_create_file_auto_appends_markdown_extension() -> None:
    """Verify new-file creation appends .md when the user omits the extension."""

    shared_utils_source = _read_static_js("shared-utils.js")
    file_tree_source = _read_static_js("file-tree.js")
    storage_source = _read_static_js("storage-backend.js")

    assert "function ensureMarkdownExtension(path)" in shared_utils_source
    assert "ensureMarkdownExtension," in shared_utils_source
    assert "window.sharedUtils?.ensureMarkdownExtension?.(rawPath)" in file_tree_source
    assert "window.sharedUtils?.ensureMarkdownExtension?.(" in storage_source
    assert "normalizeWorkspacePath(path)," in storage_source


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
    assert "window.wysiwygTables?.handleTableBackspace?.(state.root)" in source
    assert "function unwrapListItemToParagraph(listItem)" in source
    assert "if (!isRangeAtElementStart(range, listItem))" in source
    assert "placeCaretAtNodeStart(replacementParagraph);" in source


def test_wysiwyg_table_backspace_selects_then_deletes_table_after_line() -> None:
    """Verify Backspace on the line after a table selects it, then deletes on repeat."""

    tables_source = _read_static_js("wysiwyg-tables.js")
    css_source = _read_static_css("styles.css")

    assert "function handleTableBackspace(root)" in tables_source
    assert "function selectTableForDeletion(wrapper)" in tables_source
    assert "function clearPendingTableDeletionIfNeeded()" in tables_source
    assert "pendingDeleteWrapper === tableWrapper" in tables_source
    assert "deleteTable(tableWrapper, { focusBlock: block })" in tables_source
    assert "table-delete-selected" in css_source
    assert "table-editor-delete-selected" in css_source


def test_wysiwyg_table_row_column_mutations_use_undo_friendly_replacement() -> None:
    """Verify row/column edits replace the table via insertHTML for native undo."""

    tables_source = _read_static_js("wysiwyg-tables.js")
    wysiwyg_source = _read_static_js("wysiwyg.js")

    assert "function replaceTableWithUndo(table, mutateDraft)" in tables_source
    assert 'document.execCommand("insertHTML", false, replacement.outerHTML)' in tables_source
    assert "function insertRowIntoDraft(table, rowIndex, position)" in tables_source
    assert "function insertColumnIntoDraft(table, colIndex, position)" in tables_source
    assert "function refreshAllTableControls(root)" in tables_source
    assert "window.wysiwygTables?.refreshAllTableControls?.(state.root)" in wysiwyg_source
    assert 'event.inputType === "historyUndo"' in wysiwyg_source


def test_wysiwyg_toolbar_exposes_ctrl_e_inline_code_shortcut() -> None:
    """Verify Ctrl/Cmd+E maps to the smart code command."""

    source = _read_static_js("wysiwyg-toolbar.js")

    assert "else if (key === \"e\")" in source
    assert "await runToolbarCommand(\"code\")" in source
    assert "const resolvedCommand = hasTextSelection() ? \"inlineCode\" : \"codeBlock\";" in source


def test_wysiwyg_inline_code_command_toggles_existing_code() -> None:
    """Verify inline-code command unwraps when selection is already in code."""

    source = _read_static_js("wysiwyg.js")

    assert "function closestCodeElement(node)" in source
    assert "function unwrapCodeElement(codeElement)" in source
    assert "const singleCodeSelection = startCode && endCode && startCode === endCode;" in source
    assert "if (singleCodeSelection) {" in source


def test_wysiwyg_inline_format_expands_word_at_collapsed_caret() -> None:
    """Verify bold/italic/strike expand to the current word when the caret is collapsed."""

    source = _read_static_js("wysiwyg.js")

    assert "function expandCollapsedRangeToWord(range)" in source
    assert "function ensureCollapsedCaretInTextNode(range)" in source
    assert "function execInlineFormatCommand(commandName)" in source
    assert "execInlineFormatCommand(\"bold\")" in source
    assert "execInlineFormatCommand(\"italic\")" in source
    assert "execInlineFormatCommand(\"strikeThrough\")" in source


def test_wysiwyg_keyboard_shortcuts_route_inline_formats_through_execute_command() -> None:
    """Verify Ctrl/Cmd formatting shortcuts use the shared inline-format command path."""

    source = _read_static_js("wysiwyg.js")

    assert "function handleFormattingShortcutCapture(event)" in source
    assert "if (key === \"b\" && !event.shiftKey && !event.altKey)" in source
    assert "command = \"bold\";" in source
    assert "if (key === \"i\" && !event.shiftKey && !event.altKey)" in source
    assert "command = \"italic\";" in source
    assert "if (key === \"x\" && event.shiftKey && !event.altKey)" in source
    assert "command = \"strike\";" in source
    assert "void executeCommand(command);" in source
    assert "document.addEventListener(\"keydown\", handleFormattingShortcutCapture, true)" in source


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


def test_wysiwyg_tables_module_is_loaded_before_editor() -> None:
    """Verify table editor helpers load before the main WYSIWYG module."""

    html_source = Path(__file__).resolve().parents[1].joinpath(
        "markdown_os",
        "static",
        "index.html",
    ).read_text(encoding="utf-8")

    tables_index = html_source.index("/static/js/wysiwyg-tables.js")
    wysiwyg_index = html_source.index("/static/js/wysiwyg.js")

    assert tables_index < wysiwyg_index


def test_wysiwyg_table_insert_focuses_first_cell() -> None:
    """Verify table insertion uses DOM APIs that place the caret in the first cell."""

    tables_source = _read_static_js("wysiwyg-tables.js")
    wysiwyg_source = _read_static_js("wysiwyg.js")

    assert "function insertTableAtCaret(root, options = {})" in tables_source
    assert "placeCaretInCell(wrapper.querySelector(\"th, td\"));" in tables_source
    assert "window.wysiwygTables?.insertTableAtCaret?.(state.root" in wysiwyg_source


def test_wysiwyg_table_controls_support_row_and_column_actions() -> None:
    """Verify table wrappers expose stepper controls and cleanup."""

    tables_source = _read_static_js("wysiwyg-tables.js")
    wysiwyg_source = _read_static_js("wysiwyg.js")
    css_source = _read_static_css("styles.css")

    assert "function decorateTables(root)" in tables_source
    assert "function cleanupTableWrappers(cloneRoot)" in tables_source
    assert 'dataset.action = `${kind}-remove`' in tables_source
    assert 'dataset.action = `${kind}-add`' in tables_source
    assert "function getActiveTableWrapper()" in tables_source
    assert "function previewDeleteRow(table, rowIndex)" in tables_source
    assert "function previewDeleteColumn(table, colIndex)" in tables_source
    assert "function previewDeleteTable(table)" in tables_source
    assert "previewDeleteRow(table, rowIndex)" in tables_source
    assert "contentLeft - 34" in tables_source
    assert "contentTop - 34" in tables_source
    assert "function getEffectiveCursorPosition(wrapper, table)" in tables_source
    assert "function updateEdgeHandlePositions(wrapper, table, cursorPosition)" in tables_source
    assert "function ensureEdgeLayer(wrapper, table)" in tables_source
    assert 'button.dataset.tableAction = spec.action' in tables_source
    assert "const cursorKey = getCursorKey(position)" in tables_source
    assert "cursorKey !== wrapperCursorKeys.get(wrapper)" in tables_source
    assert "rowDeleteTop = cellRect.top - wrapperRect.top + cellRect.height / 2 - handleHalf" in tables_source
    assert "min-height: 4rem" in css_source
    assert "height: 4rem" in css_source
    assert "min-width: 4rem" in css_source
    assert "previewInsertColumn(wrapper, table, colIndex)" in tables_source
    assert "table-row-insert-handle" in tables_source
    assert "function getTableContentRect(table)" in tables_source
    assert "function ensureTableBody(table)" in tables_source
    assert "isHeaderRow && position === \"after\"" in tables_source
    assert "function syncTableEditorState()" in tables_source
    assert "table-delete-table-button" in tables_source
    assert "window.wysiwygTables?.decorateTables?.(state.root);" in wysiwyg_source
    assert "window.wysiwygTables?.cleanupTableWrappers?.(cloneRoot);" in wysiwyg_source
    assert ".table-floating-toolbar" in css_source
    assert ".table-stepper-group" in css_source
    assert ".table-insert-preview-line" in css_source
    assert ".table-editor-wrapper {" in css_source
    assert "padding-top: 12px" in css_source
    assert "padding-left: 12px" in css_source
    assert "#wysiwyg-editor td:empty::before" in css_source
    assert ".table-row-insert-handle" in css_source
    assert ".table-editor-wrapper.table-editor-active .table-row-delete-handle" in css_source
    assert "pointer-events: auto" in css_source


def test_wysiwyg_clears_mermaid_canvas_before_rerender() -> None:
    """Verify stale Mermaid SVGs are removed before async re-render completes."""

    source = _read_static_js("wysiwyg.js")

    assert "canvas.replaceChildren();" in source
    assert "rerenderMermaidDiagramsForTheme," in source


def test_pdf_export_awaits_explicit_mermaid_rerender() -> None:
    """Verify PDF export prepares light content off-screen without theme flashing."""

    source = _read_static_js("pdf-export.js")
    wysiwyg_source = _read_static_js("wysiwyg.js")

    assert "createOffscreenExportRoot" in source
    assert "prepareMermaidInExportRoot" in source
    assert "renderMermaidContainers" in source
    assert "installLiveExportStyles();" in source
    assert "forceLightReadableColors(host);" in source
    assert "data-pdf-export-root" in source
    assert "PDF_LIGHT_THEME_VARIABLES" in source
    assert "clone.style.setProperty(variableName, value);" in source
    assert "visibility:hidden" not in source
    assert "applyTheme" not in source
    assert "hasRenderableMermaidDiagram" not in source
    assert "waitForMermaidDiagrams" not in source
    assert "renderMermaidContainers," in wysiwyg_source
    assert "canvas.replaceChildren();" in wysiwyg_source


def test_pdf_export_sanitizes_unsupported_color_functions() -> None:
    """Verify export strips the style carriers of oklab/color-mix colors."""

    source = _read_static_js("pdf-export.js")

    assert '"box-shadow",' in source
    assert '"text-shadow",' in source
    assert '"text-decoration-color",' in source
    assert "sanitizeInlineStylesInSubtree(clone);" in source
    assert "EDITOR_STATE_CLASSES" in source
    assert '"table-row-highlight",' in source
    assert "outline: none !important;" in source
    assert "box-shadow: none !important;" in source


def test_custom_tooltips_replace_native_title_tooltips() -> None:
    """Verify custom tooltips are loaded and theme-styled with shortcut keys."""

    html_source = Path(__file__).resolve().parents[1].joinpath(
        "markdown_os",
        "static",
        "index.html",
    ).read_text(encoding="utf-8")
    tooltip_source = _read_static_js("tooltip.js")
    styles_source = _read_static_css("styles.css")
    themes_source = _read_static_css("themes.css")
    wysiwyg_source = _read_static_js("wysiwyg.js")

    assert '/static/js/tooltip.js' in html_source
    assert html_source.index('/static/js/tooltip.js') < html_source.index('/static/js/editor.js')
    assert "window.MarkdownOS.tooltip" in tooltip_source
    assert "parseTooltipText" in tooltip_source
    assert "data-tooltip" in tooltip_source
    assert "app-tooltip-kbd" in tooltip_source
    assert "--tooltip-bg" in styles_source
    assert "--tooltip-border" in styles_source
    assert ".app-tooltip" in styles_source
    assert "--tooltip-bg: #2a2a2a" in themes_source
    assert 'button.getAttribute("data-tooltip") || button.getAttribute("title")' in wysiwyg_source
