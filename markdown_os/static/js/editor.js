(() => {
  const { AUTOSAVE_DELAY_MS, setSaveStatus, setContentLoadingState } = window.sharedUtils;

  const editorState = {
    saveTimeout: null,
    lastSavedContent: "",
    isSaving: false,
    currentFilePath: null,
    mode: "file",
    nextUploadId: 0,
    isReadOnly: false,
  };
  const tocUpdateState = {
    timeout: null,
  };
  const quickActionsState = {
    open: false,
  };

  function closeQuickActionsMenu() {
    const root = document.getElementById("quick-actions-menu");
    const menu = document.getElementById("quick-actions-dropdown");
    const toggle = document.getElementById("quick-actions-toggle");
    if (!root || !menu || !toggle) {
      return;
    }
    quickActionsState.open = false;
    root.classList.remove("open");
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }

  function openQuickActionsMenu() {
    const root = document.getElementById("quick-actions-menu");
    const menu = document.getElementById("quick-actions-dropdown");
    const toggle = document.getElementById("quick-actions-toggle");
    if (!root || !menu || !toggle) {
      return;
    }
    quickActionsState.open = true;
    root.classList.add("open");
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
  }

  function bindQuickActionsMenu() {
    const root = document.getElementById("quick-actions-menu");
    const toggle = document.getElementById("quick-actions-toggle");
    const focusModeButton = document.getElementById("focus-mode-button");
    if (!root || !toggle) {
      return;
    }

    toggle.addEventListener("click", () => {
      if (quickActionsState.open) {
        closeQuickActionsMenu();
        return;
      }
      openQuickActionsMenu();
    });

    focusModeButton?.addEventListener("click", () => {
      window.MarkdownOS?.focusMode?.toggle?.();
      closeQuickActionsMenu();
    });

    document.addEventListener("pointerdown", (event) => {
      if (!quickActionsState.open) {
        return;
      }
      if (event.target instanceof Node && root.contains(event.target)) {
        return;
      }
      closeQuickActionsMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && quickActionsState.open) {
        event.preventDefault();
        closeQuickActionsMenu();
      }
    });
  }

  function getDisplayName(metadata) {
    return metadata?.relative_path || (metadata?.path ? metadata.path.replace(/^.*[/\\]/, "") : "");
  }

  function setPageTitle(metadata) {
    const displayName = getDisplayName(metadata);
    const currentFilePath = document.getElementById("current-file-path");
    const currentFileText = document.getElementById("current-file-text");

    if (currentFilePath && currentFileText) {
      if (displayName) {
        currentFileText.textContent = displayName;
        currentFilePath.classList.remove("hidden");
      } else {
        currentFileText.textContent = "";
        if (editorState.mode === "file") {
          currentFilePath.classList.add("hidden");
        }
      }
    }

    document.title = displayName ? `${displayName}` : "Markdown-OS";
  }

  function setLoadingState(isLoading) {
    const loading = document.getElementById("app-loading");
    const container = document.getElementById("app-container");
    if (!loading || !container) {
      return;
    }

    if (isLoading) {
      loading.classList.remove("hidden");
      container.classList.add("hidden");
      return;
    }

    loading.classList.add("hidden");
    container.classList.remove("hidden");
  }

  async function detectMode() {
    return window.MarkdownOS?.storage?.detectMode?.() || "file";
  }

  function isWorkspaceMode(mode) {
    return mode === "folder" || mode === "web";
  }

  function setEmptyStateCopy(title, subtitle) {
    const titleElement =
      document.getElementById("empty-state-title") ||
      document.querySelector("#empty-state .empty-state-title");
    const subtitleElement =
      document.getElementById("empty-state-subtitle") ||
      document.querySelector("#empty-state .empty-state-subtitle");
    if (titleElement) {
      titleElement.textContent = title;
    }
    if (subtitleElement) {
      subtitleElement.textContent = subtitle;
    }
  }

  function syncDesktopBodyClass() {
    document.body.classList.toggle(
      "desktop-shell-active",
      Boolean(window.markdownOSDesktop?.isDesktopMode?.()),
    );
  }

  function buildContentUrl(filePath = null) {
    if (editorState.mode === "file") {
      return "/api/content";
    }

    const targetPath = filePath || editorState.currentFilePath;
    if (!targetPath) {
      return null;
    }

    return `/api/content?file=${encodeURIComponent(targetPath)}`;
  }

  function currentMarkdown() {
    return window.wysiwyg?.getMarkdown?.() || "";
  }

  async function setMarkdown(content, options = {}) {
    if (!window.wysiwyg?.setMarkdown) {
      return;
    }
    await window.wysiwyg.setMarkdown(content, options);
  }

  function setEditorReadOnly(isReadOnly) {
    editorState.isReadOnly = Boolean(isReadOnly);
    const editor = document.getElementById("wysiwyg-editor");
    if (editor) {
      editor.setAttribute("contenteditable", String(!editorState.isReadOnly));
      editor.classList.toggle("is-read-only", editorState.isReadOnly);
      editor.setAttribute("aria-readonly", String(editorState.isReadOnly));
    }
    if (editorState.isReadOnly) {
      setSaveStatus("Browser copy only", "neutral");
    }
  }

  function saveStatusForPayload(payload) {
    const syncStatus = payload?.metadata?.sync_status;
    if (syncStatus === "synced") {
      return "Synced to file";
    }
    if (syncStatus === "browser" || syncStatus === "browser-copy") {
      return "Stored in browser";
    }
    return "Saved";
  }

  async function loadContent(filePath = null) {
    if (isWorkspaceMode(editorState.mode) && window.fileTabs?.isEnabled()) {
      return window.fileTabs.reloadTab(filePath || window.fileTabs.getActiveTabPath());
    }

    if (editorState.mode === "empty") {
      await setMarkdown("", { silent: true });
      editorState.lastSavedContent = "";
      editorState.currentFilePath = null;
      setEmptyStateCopy(
        "Open a markdown file or workspace folder",
        "Use the picker to open a file or folder.",
      );
      setSaveStatus("Open a file or folder");
      setPageTitle(null);
      setLoadingState(false);
      window.fileTree?.setCurrentFile?.(null);
      window.fileTabs?.reset?.({ keepEnabled: false });
      window.fileTabs?.setEmptyState?.(true);
      return false;
    }

    const targetPath = filePath || editorState.currentFilePath;
    if (isWorkspaceMode(editorState.mode) && !targetPath) {
      await setMarkdown("", { silent: true });
      editorState.lastSavedContent = "";
      setSaveStatus("Select a file");
      setPageTitle(null);
      setLoadingState(false);
      return false;
    }

    const container = document.getElementById("app-container");
    const isInitialLoad = container?.classList.contains("hidden") ?? true;
    if (isInitialLoad) {
      setLoadingState(true);
    } else {
      setContentLoadingState(true);
    }

    try {
      const payload = await window.MarkdownOS?.storage?.getContent?.(targetPath);
      const initialContent = payload.content || "";
      await setMarkdown(initialContent, { silent: true });
      editorState.lastSavedContent = initialContent;
      setEmptyStateCopy("No file selected", "Select a file from the sidebar to open it.");
      setEditorReadOnly(payload.metadata?.read_only === true);

      setPageTitle(payload.metadata);

      if (isWorkspaceMode(editorState.mode)) {
        const relativePath = payload.metadata?.relative_path || filePath || null;
        editorState.currentFilePath = relativePath;
        if (relativePath && window.fileTree?.setCurrentFile) {
          window.fileTree.setCurrentFile(relativePath);
        }
      }

      if (typeof window.generateTOC === "function") {
        window.generateTOC();
      }
      setSaveStatus(payload.metadata?.read_only ? "Browser copy only" : "Loaded", "saved");
      return true;
    } catch (error) {
      console.error("Failed to load markdown content.", error);
      setSaveStatus("Load failed", "error");
      return false;
    } finally {
      if (isInitialLoad) {
        setLoadingState(false);
      } else {
        setContentLoadingState(false);
      }
    }
  }

  async function checkForExternalChanges(filePath = null) {
    if (editorState.mode === "empty") {
      return false;
    }

    if (isWorkspaceMode(editorState.mode) && window.fileTabs?.isEnabled()) {
      return window.fileTabs.checkForExternalChanges(filePath || window.fileTabs.getActiveTabPath());
    }

    if (editorState.mode === "web") {
      return false;
    }

    return (
      (await window.MarkdownOS?.storage?.checkForExternalChanges?.(
        filePath,
        editorState.lastSavedContent,
      )) || false
    );
  }

  async function showConflictDialog() {
    return new Promise((resolve) => {
      const modal = document.getElementById("conflict-modal");
      const overlay = document.getElementById("conflict-overlay");
      const saveButton = document.getElementById("conflict-save");
      const discardButton = document.getElementById("conflict-discard");
      const cancelButton = document.getElementById("conflict-cancel");

      if (!modal || !overlay || !saveButton || !discardButton || !cancelButton) {
        resolve("cancel");
        return;
      }

      const previousFocus = document.activeElement;
      const previousScrollTop = window.wysiwyg?.getScrollTop?.() ?? null;
      let choiceMade = false;

      const { focusWithoutScroll } = window.sharedUtils;

      const cleanup = () => {
        document.removeEventListener("keydown", onEscape);
        overlay.onclick = null;
        saveButton.onclick = null;
        discardButton.onclick = null;
        cancelButton.onclick = null;
      };

      const choose = (choice) => {
        if (choiceMade) {
          return;
        }

        choiceMade = true;
        modal.classList.add("hidden");
        overlay.classList.add("hidden");
        cleanup();
        focusWithoutScroll(previousFocus);
        if (Number.isFinite(previousScrollTop)) {
          window.requestAnimationFrame(() => {
            window.wysiwyg?.setScrollTop?.(previousScrollTop);
          });
        }
        resolve(choice);
      };

      const onEscape = (event) => {
        if (event.key === "Escape") {
          choose("cancel");
        }
      };

      saveButton.onclick = () => choose("save");
      discardButton.onclick = () => choose("discard");
      cancelButton.onclick = () => choose("cancel");
      overlay.onclick = () => choose("cancel");
      document.addEventListener("keydown", onEscape);

      modal.classList.remove("hidden");
      overlay.classList.remove("hidden");
      focusWithoutScroll(saveButton);
    });
  }

  async function saveContent() {
    if (editorState.mode === "empty") {
      setSaveStatus("Open a file or folder", "error");
      return false;
    }

    if (editorState.isReadOnly) {
      setSaveStatus("Browser copy only", "neutral");
      return false;
    }

    if (isWorkspaceMode(editorState.mode) && window.fileTabs?.isEnabled()) {
      return window.fileTabs.saveTabContent(window.fileTabs.getActiveTabPath());
    }

    if (editorState.isSaving) {
      return false;
    }

    if (isWorkspaceMode(editorState.mode) && !editorState.currentFilePath) {
      setSaveStatus("Select a file", "error");
      return false;
    }

    editorState.isSaving = true;
    const content = currentMarkdown();
    setSaveStatus("Saving...", "saving");

    try {
      const responsePayload = await window.MarkdownOS?.storage?.saveContent?.(
        content,
        editorState.currentFilePath,
      );
      if (isWorkspaceMode(editorState.mode)) {
        const relativePath = responsePayload.metadata?.relative_path || editorState.currentFilePath;
        editorState.currentFilePath = relativePath;
        if (relativePath && window.fileTree?.setCurrentFile) {
          window.fileTree.setCurrentFile(relativePath);
        }
      }

      editorState.lastSavedContent = content;
      setSaveStatus(saveStatusForPayload(responsePayload), "saved");
      return true;
    } catch (error) {
      console.error("Failed to save markdown content.", error);
      setSaveStatus("Save failed", "error");
      return false;
    } finally {
      editorState.isSaving = false;
    }
  }

  function queueAutosave() {
    if (editorState.saveTimeout) {
      window.clearTimeout(editorState.saveTimeout);
    }

    editorState.saveTimeout = window.setTimeout(() => {
      if (isWorkspaceMode(editorState.mode) && !editorState.currentFilePath) {
        return;
      }
      saveContent();
    }, AUTOSAVE_DELAY_MS);
  }

  function queueTOCUpdate() {
    if (tocUpdateState.timeout) {
      window.clearTimeout(tocUpdateState.timeout);
    }

    tocUpdateState.timeout = window.setTimeout(() => {
      if (typeof window.generateTOC === "function") {
        window.generateTOC();
      }
    }, 180);
  }

  function onEditorInput() {
    if (editorState.isReadOnly) {
      setSaveStatus("Browser copy only", "neutral");
      return;
    }

    const markdown = currentMarkdown();

    if (isWorkspaceMode(editorState.mode) && window.fileTabs?.isEnabled()) {
      const activePath = window.fileTabs.getActiveTabPath();
      if (!activePath) {
        setSaveStatus("Select a file", "error");
        return;
      }

      const tabData = window.fileTabs.getTabData(activePath);
      if (!tabData) {
        return;
      }

      tabData.content = markdown;
      const isDirty = window.fileTabs.updateTabDirtyState(activePath);
      if (isDirty) {
        setSaveStatus("Unsaved changes");
        window.fileTabs.queueTabAutosave(activePath);
      }
      queueTOCUpdate();
      return;
    }

    if (isWorkspaceMode(editorState.mode) && !editorState.currentFilePath) {
      setSaveStatus("Select a file", "error");
      return;
    }

    if (markdown !== editorState.lastSavedContent) {
      setSaveStatus("Unsaved changes");
      queueAutosave();
    }

    queueTOCUpdate();
  }

  async function handleExternalChange(detail) {
    if (isWorkspaceMode(editorState.mode) && window.fileTabs?.isEnabled()) {
      await window.fileTabs.handleExternalChange(detail);
      return;
    }

    if (!detail || typeof detail.content !== "string") {
      return;
    }

    if (isWorkspaceMode(editorState.mode) && detail.file !== editorState.currentFilePath) {
      return;
    }

    const content = currentMarkdown();
    if (detail.content === content) {
      return;
    }

    const hasUnsavedChanges = content !== editorState.lastSavedContent;
    if (!hasUnsavedChanges) {
      await setMarkdown(detail.content, { silent: true });
      editorState.lastSavedContent = detail.content;
      if (typeof window.generateTOC === "function") {
        window.generateTOC();
      }
      setSaveStatus("Reloaded from disk", "saved");
      return;
    }

    const shouldReload = await window.markdownDialogs?.confirm?.({
      title: "External Change Detected",
      message:
        "This file was changed externally and you have unsaved changes. Reload and discard your changes?",
      confirmText: "Reload",
      cancelText: "Keep mine",
      confirmVariant: "danger",
    });
    if (!shouldReload) {
      setSaveStatus("External change ignored");
      return;
    }

    await setMarkdown(detail.content, { silent: true });
    editorState.lastSavedContent = detail.content;
    if (typeof window.generateTOC === "function") {
      window.generateTOC();
    }
    setSaveStatus("Reloaded from disk", "saved");
  }

  async function switchFile(filePath) {
    if (!filePath) {
      return false;
    }

    if (!isWorkspaceMode(editorState.mode)) {
      editorState.mode = await detectMode();
      if (!isWorkspaceMode(editorState.mode)) {
        return false;
      }
    }

    if (isWorkspaceMode(editorState.mode) && window.fileTabs) {
      if (!window.fileTabs.isEnabled()) {
        window.fileTabs.init(editorState.mode);
      }
      return window.fileTabs.openTab(filePath);
    }

    if (filePath === editorState.currentFilePath) {
      return true;
    }

    const hasUnsavedChanges = currentMarkdown() !== editorState.lastSavedContent;
    if (hasUnsavedChanges && editorState.currentFilePath) {
      const hasConflict = await checkForExternalChanges(editorState.currentFilePath);
      if (hasConflict) {
        const choice = await showConflictDialog();
        if (choice === "save") {
          const saved = await saveContent();
          if (!saved) {
            return false;
          }
        } else if (choice !== "discard") {
          return false;
        }
      } else {
        const saved = await saveContent();
        if (!saved) {
          return false;
        }
      }
    }

    const loaded = await loadContent(filePath);
    if (!loaded) {
      return false;
    }

    editorState.currentFilePath = filePath;
    if (window.fileTree?.setCurrentFile) {
      window.fileTree.setCurrentFile(filePath);
    }

    return true;
  }

  function extensionFromMimeType(mimeType) {
    const mimeToExtension = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "image/bmp": "bmp",
      "image/x-icon": "ico",
      "image/vnd.microsoft.icon": "ico",
    };
    return mimeToExtension[mimeType] || "png";
  }

  function isMarkdownImportFile(file) {
    const name = file?.webkitRelativePath || file?.name || "";
    return /\.(md|markdown)$/i.test(name);
  }

  async function handleMarkdownFileImport(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) {
      return false;
    }

    setSaveStatus("Importing markdown...", "saving");
    try {
      const payload = await window.MarkdownOS?.storage?.importFiles?.(files);
      if (isWorkspaceMode(editorState.mode)) {
        await window.fileTree?.loadFileTree?.();
        await window.fileTree?.openImportedPath?.(payload);
      } else if (editorState.mode === "file") {
        await loadContent();
      }
      setSaveStatus(payload?.readOnly ? "Browser copy only" : "Markdown imported", "saved");
      return true;
    } catch (error) {
      console.error("Markdown import failed.", error);
      setSaveStatus("Markdown import failed", "error");
      return false;
    }
  }

  function hasDraggedFiles(event) {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  }

  function markdownFilesFromFileList(fileList) {
    return Array.from(fileList || []).filter(isMarkdownImportFile);
  }

  function imageFilesFromFileList(fileList) {
    return Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
  }

  function setDragOverState(isActive) {
    document.getElementById("editor-container")?.classList.toggle("drag-over", isActive);
  }

  function handleMarkdownDragOver(event) {
    if (!hasDraggedFiles(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragOverState(true);
  }

  function handleMarkdownDragLeave(event) {
    if (event.relatedTarget instanceof Node && document.body.contains(event.relatedTarget)) {
      return;
    }
    setDragOverState(false);
  }

  async function handleMarkdownDrop(event) {
    if (!hasDraggedFiles(event)) {
      return;
    }

    const files = event.dataTransfer?.files;
    const markdownFiles = markdownFilesFromFileList(files);
    if (markdownFiles.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragOverState(false);

    const handlePayload =
      await window.MarkdownOS?.storage?.importDataTransferItems?.(event.dataTransfer?.items);
    if (handlePayload?.paths?.length > 0) {
      await window.fileTree?.loadFileTree?.();
      await window.fileTree?.openImportedPath?.(handlePayload);
      setSaveStatus("Synced to file", "saved");
      return;
    }

    await handleMarkdownFileImport(markdownFiles);
  }

  function bindMarkdownDropEvents() {
    document.addEventListener("dragenter", handleMarkdownDragOver, true);
    document.addEventListener("dragover", handleMarkdownDragOver, true);
    document.addEventListener("dragleave", handleMarkdownDragLeave, true);
    document.addEventListener("drop", handleMarkdownDrop, true);
  }

  async function handleImageUpload(file) {
    if (!file) {
      return;
    }

    editorState.nextUploadId += 1;
    setSaveStatus("Uploading image...", "saving");

    const extension = file.name?.includes(".")
      ? file.name.split(".").pop().toLowerCase()
      : extensionFromMimeType(file.type);
    const filename = file.name || `paste-${editorState.nextUploadId}.${extension}`;

    try {
      const payload = await window.MarkdownOS?.storage?.uploadImage?.(file, filename);
      await window.wysiwyg?.insertImage?.(payload.path, "image");
      setSaveStatus("Image uploaded", "saved");
    } catch (error) {
      console.error("Image upload failed.", error);
      setSaveStatus("Image upload failed", "error");
    }
  }

  function bindImageEvents() {
    const editor = document.getElementById("wysiwyg-editor");
    const container = document.getElementById("editor-container");
    if (!editor || !container) {
      return;
    }

    editor.addEventListener("paste", (event) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      for (const item of items) {
        if (!item.type.startsWith("image/")) {
          continue;
        }

        const file = item.getAsFile();
        if (!file) {
          continue;
        }

        event.preventDefault();
        handleImageUpload(file);
        return;
      }
    });

    container.addEventListener("dragover", (event) => {
      if (!hasDraggedFiles(event)) {
        return;
      }
      event.preventDefault();
      setDragOverState(true);
    });

    container.addEventListener("dragleave", () => {
      setDragOverState(false);
    });

    container.addEventListener("drop", (event) => {
      setDragOverState(false);
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0 || markdownFilesFromFileList(files).length > 0) {
        return;
      }

      const imageFiles = imageFilesFromFileList(files);
      if (imageFiles.length === 0) {
        return;
      }

      event.preventDefault();
      imageFiles.forEach((file) => {
        handleImageUpload(file);
      });
    });
  }

  function bindEvents() {
    bindImageEvents();
    bindMarkdownDropEvents();
    bindQuickActionsMenu();

    document.getElementById("export-pdf-button")?.addEventListener("click", () => {
      window.MarkdownOS?.pdfExport?.exportToPdf?.();
      closeQuickActionsMenu();
    });

    if (window.wysiwyg?.onChange) {
      window.wysiwyg.onChange(onEditorInput);
    }

    window.addEventListener("markdown-os:file-changed", (event) => {
      handleExternalChange(event.detail);
    });

    window.addEventListener("markdown-os:websocket-status", (event) => {
      if (event.detail.status === "error") {
        setSaveStatus("Realtime sync unavailable", "error");
      }
    });

    window.addEventListener("markdown-os:desktop-state", async (event) => {
      const snapshot = event.detail || {};
      const nextMode = snapshot.mode || editorState.mode;
      editorState.mode = nextMode;
      syncDesktopBodyClass();

      if (nextMode === "empty") {
        window.fileTree?.setMode?.("empty");
        await loadContent();
        return;
      }

      if (nextMode === "file") {
        window.fileTree?.setMode?.("file");
        window.fileTree?.hideFolderModeUI?.();
        window.fileTabs?.init?.("file");
        window.fileTabs?.setEmptyState?.(false);
        await loadContent();
        return;
      }

      if (nextMode === "folder") {
        window.fileTree?.setMode?.("folder");
        window.fileTabs?.init?.("folder");
        await window.fileTabs?.resetWorkspace?.();
        window.fileTree?.setFolderModeUI?.();
        await window.fileTree?.loadFileTree?.();
        setSaveStatus("Select a file");
        window.fileTabs?.setEmptyState?.(true);
      }
    });
  }

  window.setEditorReadOnly = setEditorReadOnly;
  window.saveStatusForPayload = saveStatusForPayload;
  window.switchFile = switchFile;
  window.loadContent = loadContent;
  window.checkForExternalChanges = checkForExternalChanges;
  window.showConflictDialog = showConflictDialog;
  window.saveContent = saveContent;

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "F") {
      e.preventDefault();
      window.MarkdownOS?.focusMode?.toggle();
    }
    if (e.key === "F11") {
      e.preventDefault();
      window.MarkdownOS?.focusMode?.toggle();
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    window.wysiwyg?.init?.();

    editorState.mode = await detectMode();
    const initialMode = editorState.mode;
    bindEvents();
    syncDesktopBodyClass();

    if (window.MarkdownOS?.desktopShell?.isDesktop?.()) {
      await window.MarkdownOS.desktopShell.fetchDesktopState?.();
      editorState.mode = await detectMode();
    }

    if (editorState.mode === "file") {
      await loadContent();
      return;
    }

    window.fileTabs?.init(editorState.mode);
    setLoadingState(false);
    if (isWorkspaceMode(editorState.mode)) {
      window.fileTree?.setMode?.(editorState.mode);
      window.fileTree?.setFolderModeUI?.();
      const tree = await window.fileTree?.loadFileTree?.();
      if (editorState.mode === "web") {
        const initialFile = new URLSearchParams(window.location.search).get("file");
        const firstFile = window.fileTree?.firstFilePath?.(tree);
        const fileToOpen = initialFile || firstFile;
        if (fileToOpen) {
          await window.fileTabs?.openTab?.(fileToOpen);
          window.desktopPicker?.setPickerVisibility?.(false);
          return;
        }
      }
      setSaveStatus("Select a file");
      window.fileTabs?.setEmptyState?.(true);
      window.desktopPicker?.setPickerVisibility?.(false);
      return;
    }

    setEmptyStateCopy(
      "Open a markdown file or workspace folder",
      "Use the picker to open a file or folder.",
    );
    setSaveStatus("Open a file or folder");
    window.fileTabs?.setEmptyState?.(true);
    window.desktopPicker?.setPickerVisibility?.(true);
  });
})();
