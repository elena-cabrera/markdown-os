(() => {
  const AUTOSAVE_DELAY_MS = 1000;
  const TOC_UPDATE_DELAY_MS = 250;

  const editorState = {
    mode: "file",
    currentFilePath: null,
    lastSavedContent: "",
    isSaving: false,
    saveTimeout: null,
  };

  const tocState = {
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

    document.title = displayName || "Markdown-OS";
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
    } catch (_error) {
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

  function queueTOCUpdate() {
    if (tocState.timeout) {
      window.clearTimeout(tocState.timeout);
    }
    tocState.timeout = window.setTimeout(() => {
      window.generateTOC?.();
    }, TOC_UPDATE_DELAY_MS);
  }

  async function uploadImage(file) {
    if (!file) {
      return "";
    }

    const formData = new FormData();
    formData.append("file", file, file.name || "image.png");

    try {
      const response = await fetch("/api/images", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `Upload failed (${response.status})`);
      }

      const payload = await response.json();
      setSaveStatus("Image uploaded", "saved");
      return payload.path || "";
    } catch (error) {
      console.error("Image upload failed.", error);
      setSaveStatus("Image upload failed", "error");
      return "";
    }
  }

  function initializeWysiwyg() {
    window.wysiwyg?.init({
      content: "",
      onMarkdownUpdate: (markdown) => {
        onEditorUpdate(markdown);
      },
      onSelectionUpdate: () => {
        queueTOCUpdate();
      },
      onUploadImage: uploadImage,
      onUploadStart: () => {
        setSaveStatus("Uploading image...", "saving");
      },
      onUploadEnd: () => {
        if (!editorState.isSaving) {
          setSaveStatus("Unsaved changes");
        }
      },
    });

    window.wysiwygToolbar?.init?.();
    window.wysiwygToolbar?.syncButtonStates?.();
  }

  async function loadContent(filePath = null) {
    if (editorState.mode === "folder" && window.fileTabs?.isEnabled()) {
      return window.fileTabs.reloadTab(filePath || window.fileTabs.getActiveTabPath());
    }

    const requestUrl = buildContentUrl(filePath);
    if (!requestUrl) {
      window.wysiwyg?.setMarkdown("", { emitUpdate: false });
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
      const markdown = payload.content || "";
      window.wysiwyg?.setMarkdown(markdown, { emitUpdate: false });
      editorState.lastSavedContent = markdown;

      setPageTitle(payload.metadata);
      if (editorState.mode === "folder") {
        const relativePath = payload.metadata?.relative_path || filePath || null;
        editorState.currentFilePath = relativePath;
        if (relativePath) {
          window.fileTree?.setCurrentFile?.(relativePath);
        }
      }

      queueTOCUpdate();
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
    } catch (_error) {
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
        cleanup();
        modal.classList.add("hidden");
        overlay.classList.add("hidden");
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

    const content = window.wysiwyg?.getMarkdown?.() || "";
    if (content === editorState.lastSavedContent) {
      setSaveStatus("Saved", "saved");
      return true;
    }

    editorState.isSaving = true;
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
        if (relativePath) {
          window.fileTree?.setCurrentFile?.(relativePath);
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

  function onEditorUpdate(markdown) {
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
      tabData.hasLocalEdits = true;

      const isDirty = window.fileTabs.updateTabDirtyState(activePath);
      if (isDirty) {
        setSaveStatus("Unsaved changes");
        window.fileTabs.queueTabAutosave(activePath);
      } else {
        setSaveStatus("Saved", "saved");
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
    } else {
      setSaveStatus("Saved", "saved");
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

    const currentMarkdown = window.wysiwyg?.getMarkdown?.() || "";
    if (detail.content === currentMarkdown) {
      return;
    }

    const hasUnsavedChanges = currentMarkdown !== editorState.lastSavedContent;
    if (!hasUnsavedChanges) {
      window.wysiwyg?.setMarkdown(detail.content, { emitUpdate: false });
      editorState.lastSavedContent = detail.content;
      queueTOCUpdate();
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

    window.wysiwyg?.setMarkdown(detail.content, { emitUpdate: false });
    editorState.lastSavedContent = detail.content;
    queueTOCUpdate();
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

    if (window.fileTabs?.isEnabled()) {
      return window.fileTabs.openTab(filePath);
    }

    if (filePath === editorState.currentFilePath) {
      return true;
    }

    const currentMarkdown = window.wysiwyg?.getMarkdown?.() || "";
    const hasUnsavedChanges = currentMarkdown !== editorState.lastSavedContent;
    if (hasUnsavedChanges && editorState.currentFilePath) {
      const hasConflict = await checkForExternalChanges(editorState.currentFilePath);
      if (hasConflict) {
        const choice = await showConflictDialog();
        if (choice === "save") {
          const saved = await saveContent();
          if (!saved) {
            return false;
          }
        } else if (choice === "discard") {
          // User chose to discard local edits.
        } else {
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
    window.fileTree?.setCurrentFile?.(filePath);
    return true;
  }

  function bindEvents() {
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
  window.getCurrentMarkdown = () => window.wysiwyg?.getMarkdown?.() || "";

  document.addEventListener("DOMContentLoaded", async () => {
    editorState.mode = await detectMode();
    initializeWysiwyg();
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
