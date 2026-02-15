(() => {
  const AUTOSAVE_DELAY_MS = 1000;

  const editorState = {
    saveTimeout: null,
    lastSavedContent: "",
    isSaving: false,
    isEditMode: false,
    currentFilePath: null,
    mode: "file",
  };

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
    const displayName =
      metadata?.relative_path ||
      (metadata?.path ? metadata.path.replace(/^.*[/\\]/, "") : null);
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

  async function loadContent(filePath = null) {
    const editor = document.getElementById("markdown-editor");
    if (!editor) {
      return false;
    }

    const requestUrl = buildContentUrl(filePath);
    if (!requestUrl) {
      editor.value = "";
      editorState.lastSavedContent = "";
      await window.renderMarkdown("");
      setSaveStatus("Select a file");
      setPageTitle(null);
      setLoadingState(false);
      return false;
    }

    setLoadingState(true);
    try {
      const response = await fetch(requestUrl);
      if (!response.ok) {
        throw new Error(`Failed to load content (${response.status})`);
      }

      const payload = await response.json();
      const initialContent = payload.content || "";
      editor.value = initialContent;
      editorState.lastSavedContent = initialContent;

      setPageTitle(payload.metadata);

      if (editorState.mode === "folder") {
        const relativePath = payload.metadata?.relative_path || filePath || null;
        editorState.currentFilePath = relativePath;
        if (relativePath && window.fileTree?.setCurrentFile) {
          window.fileTree.setCurrentFile(relativePath);
        }
      }

      await window.renderMarkdown(initialContent);
      setSaveStatus("Loaded", "saved");
      return true;
    } catch (error) {
      console.error("Failed to load markdown content.", error);
      setSaveStatus("Load failed", "error");
      return false;
    } finally {
      setLoadingState(false);
    }
  }

  async function checkForExternalChanges(filePath = null) {
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
        console.error("Conflict modal elements not found.");
        resolve("cancel");
        return;
      }

      const previousFocus = document.activeElement;
      let choiceMade = false;

      const cleanup = () => {
        document.removeEventListener("keydown", handleEscape);
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

      const handleEscape = (event) => {
        if (event.key === "Escape") {
          choose("cancel");
        }
      };

      saveButton.onclick = () => choose("save");
      discardButton.onclick = () => choose("discard");
      cancelButton.onclick = () => choose("cancel");
      overlay.onclick = () => choose("cancel");
      document.addEventListener("keydown", handleEscape);

      modal.classList.remove("hidden");
      overlay.classList.remove("hidden");
      saveButton.focus();
    });
  }

  async function switchToTab(tabName) {
    const editTab = document.getElementById("edit-tab");
    const previewTab = document.getElementById("preview-tab");
    const editorContainer = document.getElementById("editor-container");
    const previewContainer = document.getElementById("preview-container");
    const editor = document.getElementById("markdown-editor");

    if (!editTab || !previewTab || !editorContainer || !previewContainer || !editor) {
      return;
    }

    if (tabName === "edit") {
      editTab.classList.add("active");
      previewTab.classList.remove("active");
      editorContainer.classList.add("active");
      previewContainer.classList.remove("active");
      editorState.isEditMode = true;
      return;
    }

    const hasUnsavedChanges = editor.value !== editorState.lastSavedContent;
    if (hasUnsavedChanges) {
      const hasConflict = await checkForExternalChanges(editorState.currentFilePath);
      if (hasConflict) {
        const choice = await showConflictDialog();
        if (choice === "save") {
          const saved = await saveContent();
          if (!saved) {
            return;
          }
        } else if (choice === "discard") {
          await loadContent(editorState.currentFilePath);
        } else {
          return;
        }
      } else {
        const saved = await saveContent();
        if (!saved) {
          return;
        }
      }
    }

    editTab.classList.remove("active");
    previewTab.classList.add("active");
    editorContainer.classList.remove("active");
    previewContainer.classList.add("active");
    editorState.isEditMode = false;
    await window.renderMarkdown(editor.value);
  }

  async function saveContent() {
    const editor = document.getElementById("markdown-editor");
    if (!editor || editorState.isSaving) {
      return false;
    }

    if (editorState.mode === "folder" && !editorState.currentFilePath) {
      setSaveStatus("Select a file", "error");
      return false;
    }

    editorState.isSaving = true;
    const content = editor.value;
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

  function onEditorInput() {
    const editor = document.getElementById("markdown-editor");
    if (!editor) {
      return;
    }

    if (editorState.mode === "folder" && !editorState.currentFilePath) {
      setSaveStatus("Select a file", "error");
      return;
    }

    if (editor.value !== editorState.lastSavedContent) {
      setSaveStatus("Unsaved changes");
      queueAutosave();
    }
  }

  async function handleExternalChange(detail) {
    const editor = document.getElementById("markdown-editor");
    if (!editor || !detail) {
      return;
    }

    if (editorState.mode === "folder") {
      if (detail.file !== editorState.currentFilePath) {
        return;
      }
    }

    if (typeof detail.content !== "string") {
      return;
    }

    if (detail.content === editor.value) {
      return;
    }

    if (!editorState.isEditMode) {
      editor.value = detail.content;
      editorState.lastSavedContent = detail.content;
      await window.renderMarkdown(detail.content);
      setSaveStatus("Reloaded from disk", "saved");
      return;
    }

    const hasUnsavedChanges = editor.value !== editorState.lastSavedContent;
    if (!hasUnsavedChanges) {
      editor.value = detail.content;
      editorState.lastSavedContent = detail.content;
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

    editor.value = detail.content;
    editorState.lastSavedContent = detail.content;
    setSaveStatus("Reloaded from disk", "saved");
  }

  async function switchFile(filePath) {
    const editor = document.getElementById("markdown-editor");
    if (!editor) {
      return false;
    }

    if (!filePath) {
      return false;
    }

    if (editorState.mode !== "folder") {
      editorState.mode = await detectMode();
      if (editorState.mode !== "folder") {
        return false;
      }
    }

    if (filePath === editorState.currentFilePath) {
      return true;
    }

    const hasUnsavedChanges = editor.value !== editorState.lastSavedContent;
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
          // User opted to keep disk state and switch files.
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
    if (window.fileTree?.setCurrentFile) {
      window.fileTree.setCurrentFile(filePath);
    }

    await switchToTab("preview");
    return true;
  }

  function bindEvents() {
    const editor = document.getElementById("markdown-editor");
    const editTab = document.getElementById("edit-tab");
    const previewTab = document.getElementById("preview-tab");
    if (!editor || !editTab || !previewTab) {
      return;
    }

    editor.addEventListener("input", onEditorInput);
    editTab.addEventListener("click", () => {
      switchToTab("edit");
    });
    previewTab.addEventListener("click", () => {
      switchToTab("preview");
    });

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
    editorState.mode = await detectMode();
    bindEvents();

    if (editorState.mode === "file") {
      await loadContent();
    } else {
      setLoadingState(false);
      setSaveStatus("Select a file");
    }

    await switchToTab("preview");
  });
})();
