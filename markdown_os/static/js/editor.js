(() => {
  const AUTOSAVE_DELAY_MS = 1000;

  const editorState = {
    saveTimeout: null,
    lastSavedContent: "",
    isSaving: false,
    currentFilePath: null,
    mode: "file",
    nextUploadId: 0,
  };
  const tocUpdateState = {
    timeout: null,
  };

  function getDisplayName(metadata) {
    return metadata?.relative_path || (metadata?.path ? metadata.path.replace(/^.*[/\\]/, "") : "");
  }

  function setSaveStatus(message, variant = "neutral") {
    const saveStatus = document.getElementById("save-status");
    if (!saveStatus) {
      return;
    }

    saveStatus.textContent = message;
    saveStatus.classList.remove("is-saving", "is-saved", "is-error");

    if (variant === "saving") {
      saveStatus.classList.add("is-saving");
    } else if (variant === "saved") {
      saveStatus.classList.add("is-saved");
    } else if (variant === "error") {
      saveStatus.classList.add("is-error");
    }
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

  function setContentLoadingState(isLoading) {
    const overlay = document.getElementById("content-loading");
    if (!overlay) {
      return;
    }

    if (isLoading) {
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      return;
    }

    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  async function detectMode() {
    try {
      const response = await fetch("/api/mode");
      if (!response.ok) {
        return "file";
      }
      const payload = await response.json();
      return payload.mode || "file";
    } catch (error) {
      console.error("Failed to detect mode.", error);
      return "file";
    }
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

  async function loadContent(filePath = null) {
    if (editorState.mode === "folder" && window.fileTabs?.isEnabled()) {
      return window.fileTabs.reloadTab(filePath || window.fileTabs.getActiveTabPath());
    }

    const requestUrl = buildContentUrl(filePath);
    if (!requestUrl) {
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
      const response = await fetch(requestUrl);
      if (!response.ok) {
        throw new Error(`Failed to load content (${response.status})`);
      }

      const payload = await response.json();
      const initialContent = payload.content || "";
      await setMarkdown(initialContent, { silent: true });
      editorState.lastSavedContent = initialContent;

      setPageTitle(payload.metadata);

      if (editorState.mode === "folder") {
        const relativePath = payload.metadata?.relative_path || filePath || null;
        editorState.currentFilePath = relativePath;
        if (relativePath && window.fileTree?.setCurrentFile) {
          window.fileTree.setCurrentFile(relativePath);
        }
      }

      if (typeof window.generateTOC === "function") {
        window.generateTOC();
      }
      setSaveStatus("Loaded", "saved");
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
    if (editorState.mode === "folder" && window.fileTabs?.isEnabled()) {
      return window.fileTabs.checkForExternalChanges(filePath || window.fileTabs.getActiveTabPath());
    }

    const requestUrl = buildContentUrl(filePath);
    if (!requestUrl) {
      return false;
    }

    try {
      const response = await fetch(requestUrl);
      if (!response.ok) {
        return false;
      }

      const payload = await response.json();
      const diskContent = payload.content || "";
      return diskContent !== editorState.lastSavedContent;
    } catch (error) {
      console.error("Failed to check for external changes.", error);
      return false;
    }
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
      let choiceMade = false;

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
        if (previousFocus && typeof previousFocus.focus === "function") {
          previousFocus.focus();
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
      saveButton.focus();
    });
  }

  async function saveContent() {
    if (editorState.mode === "folder" && window.fileTabs?.isEnabled()) {
      return window.fileTabs.saveTabContent(window.fileTabs.getActiveTabPath());
    }

    if (editorState.isSaving) {
      return false;
    }

    if (editorState.mode === "folder" && !editorState.currentFilePath) {
      setSaveStatus("Select a file", "error");
      return false;
    }

    editorState.isSaving = true;
    const content = currentMarkdown();
    setSaveStatus("Saving...", "saving");

    try {
      const payload = { content };
      if (editorState.mode === "folder") {
        payload.file = editorState.currentFilePath;
      }

      const response = await fetch("/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }

      const responsePayload = await response.json();
      if (editorState.mode === "folder") {
        const relativePath = responsePayload.metadata?.relative_path || editorState.currentFilePath;
        editorState.currentFilePath = relativePath;
        if (relativePath && window.fileTree?.setCurrentFile) {
          window.fileTree.setCurrentFile(relativePath);
        }
      }

      editorState.lastSavedContent = content;
      setSaveStatus("Saved", "saved");
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
      if (editorState.mode === "folder" && !editorState.currentFilePath) {
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
    const markdown = currentMarkdown();

    if (editorState.mode === "folder" && window.fileTabs?.isEnabled()) {
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

    if (editorState.mode === "folder" && !editorState.currentFilePath) {
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
    if (editorState.mode === "folder" && window.fileTabs?.isEnabled()) {
      await window.fileTabs.handleExternalChange(detail);
      return;
    }

    if (!detail || typeof detail.content !== "string") {
      return;
    }

    if (editorState.mode === "folder" && detail.file !== editorState.currentFilePath) {
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

    const shouldReload = window.confirm(
      "This file was changed externally and you have unsaved changes. Reload and discard your changes?",
    );
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

    if (editorState.mode !== "folder") {
      editorState.mode = await detectMode();
      if (editorState.mode !== "folder") {
        return false;
      }
    }

    if (editorState.mode === "folder" && window.fileTabs) {
      if (!window.fileTabs.isEnabled()) {
        window.fileTabs.init("folder");
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

  async function handleImageUpload(file) {
    if (!file) {
      return;
    }

    editorState.nextUploadId += 1;
    setSaveStatus("Uploading image...", "saving");

    const formData = new FormData();
    const extension = file.name?.includes(".")
      ? file.name.split(".").pop().toLowerCase()
      : extensionFromMimeType(file.type);
    const filename = file.name || `paste-${editorState.nextUploadId}.${extension}`;
    formData.append("file", file, filename);

    try {
      const response = await fetch("/api/images", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.detail || `Upload failed (${response.status})`);
      }

      const payload = await response.json();
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
      const hasFiles = Array.from(event.dataTransfer?.types || []).includes("Files");
      if (!hasFiles) {
        return;
      }
      event.preventDefault();
      container.classList.add("drag-over");
    });

    container.addEventListener("dragleave", () => {
      container.classList.remove("drag-over");
    });

    container.addEventListener("drop", (event) => {
      container.classList.remove("drag-over");
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) {
        return;
      }

      const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
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
  }

  window.switchFile = switchFile;
  window.loadContent = loadContent;
  window.checkForExternalChanges = checkForExternalChanges;
  window.showConflictDialog = showConflictDialog;
  window.saveContent = saveContent;

  document.addEventListener("DOMContentLoaded", async () => {
    window.wysiwyg?.init?.();

    editorState.mode = await detectMode();
    bindEvents();

    if (editorState.mode === "file") {
      await loadContent();
      return;
    }

    window.fileTabs?.init(editorState.mode);
    setLoadingState(false);
    setSaveStatus("Select a file");
    window.fileTabs?.setEmptyState?.(true);
  });
})();
