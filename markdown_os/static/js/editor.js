(() => {
  const AUTOSAVE_DELAY_MS = 1000;

  const editorState = {
    saveTimeout: null,
    lastSavedContent: "",
    isSaving: false,
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

  async function loadContent() {
    const editor = document.getElementById("markdown-editor");
    if (!editor) {
      return;
    }

    setLoadingState(true);
    try {
      const response = await fetch("/api/content");
      if (!response.ok) {
        throw new Error(`Failed to load content (${response.status})`);
      }

      const payload = await response.json();
      const initialContent = payload.content || "";
      editor.value = initialContent;
      editorState.lastSavedContent = initialContent;
      await window.renderMarkdown(initialContent);
      setSaveStatus("Loaded", "saved");
    } catch (error) {
      console.error("Failed to load markdown content.", error);
      setSaveStatus("Load failed", "error");
    } finally {
      setLoadingState(false);
    }
  }

  function switchToTab(tabName) {
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
      return;
    }

    editTab.classList.remove("active");
    previewTab.classList.add("active");
    editorContainer.classList.remove("active");
    previewContainer.classList.add("active");
    window.renderMarkdown(editor.value);
  }

  async function saveContent() {
    const editor = document.getElementById("markdown-editor");
    if (!editor || editorState.isSaving) {
      return;
    }

    editorState.isSaving = true;
    const content = editor.value;
    setSaveStatus("Saving...", "saving");

    try {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }

      editorState.lastSavedContent = content;
      setSaveStatus("Saved", "saved");
    } catch (error) {
      console.error("Failed to save markdown content.", error);
      setSaveStatus("Save failed", "error");
    } finally {
      editorState.isSaving = false;
    }
  }

  function queueAutosave() {
    if (editorState.saveTimeout) {
      window.clearTimeout(editorState.saveTimeout);
    }

    editorState.saveTimeout = window.setTimeout(() => {
      saveContent();
    }, AUTOSAVE_DELAY_MS);
  }

  function onEditorInput() {
    const editor = document.getElementById("markdown-editor");
    if (!editor) {
      return;
    }

    window.renderMarkdown(editor.value);
    if (editor.value !== editorState.lastSavedContent) {
      setSaveStatus("Unsaved changes");
      queueAutosave();
    }
  }

  async function handleExternalChange(detail) {
    const editor = document.getElementById("markdown-editor");
    if (!editor || !detail || typeof detail.content !== "string") {
      return;
    }

    if (detail.content === editor.value) {
      return;
    }

    const shouldReload = window.confirm(
      "This file was changed externally. Reload content from disk?",
    );
    if (!shouldReload) {
      setSaveStatus("External change ignored");
      return;
    }

    editor.value = detail.content;
    editorState.lastSavedContent = detail.content;
    await window.renderMarkdown(detail.content);
    setSaveStatus("Reloaded from disk", "saved");
  }

  function bindEvents() {
    const editor = document.getElementById("markdown-editor");
    const editTab = document.getElementById("edit-tab");
    const previewTab = document.getElementById("preview-tab");
    if (!editor || !editTab || !previewTab) {
      return;
    }

    editor.addEventListener("input", onEditorInput);
    editTab.addEventListener("click", () => switchToTab("edit"));
    previewTab.addEventListener("click", () => switchToTab("preview"));

    window.addEventListener("markdown-os:file-changed", (event) => {
      handleExternalChange(event.detail);
    });
    window.addEventListener("markdown-os:websocket-status", (event) => {
      if (event.detail.status === "error") {
        setSaveStatus("Realtime sync unavailable", "error");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();
    await loadContent();
    switchToTab("edit");
  });
})();
