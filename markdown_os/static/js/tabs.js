(() => {
  const AUTOSAVE_DELAY_MS = 1000;
  const MAX_OPEN_TABS = 15;

  const tabsState = {
    tabs: new Map(),
    tabOrder: [],
    activeTabPath: null,
    enabled: false,
    scrollBound: false,
  };

  function getEditorElements() {
    return {
      editor: document.getElementById("markdown-editor"),
      previewContainer: document.getElementById("preview-container"),
      editTab: document.getElementById("edit-tab"),
      previewTab: document.getElementById("preview-tab"),
      editorContainer: document.getElementById("editor-container"),
    };
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

  function setPageTitle(filePath) {
    const currentFileText = document.getElementById("current-file-text");
    const currentFilePath = document.getElementById("current-file-path");
    if (currentFileText) {
      currentFileText.textContent = filePath || "";
    }
    if (currentFilePath && !filePath) {
      currentFilePath.classList.add("hidden");
    } else {
      currentFilePath?.classList.remove("hidden");
    }
    document.title = filePath || "Markdown-OS";
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

  function basename(filePath) {
    if (!filePath) {
      return "";
    }
    const parts = filePath.split("/");
    return parts[parts.length - 1] || filePath;
  }

  function splitPath(filePath) {
    return (filePath || "").split("/").filter(Boolean);
  }

  function displayNameMap() {
    const namesByPath = new Map();
    const groups = new Map();

    for (const filePath of tabsState.tabOrder) {
      const base = basename(filePath);
      if (!groups.has(base)) {
        groups.set(base, []);
      }
      groups.get(base).push(filePath);
      namesByPath.set(filePath, base);
    }

    for (const groupedPaths of groups.values()) {
      if (groupedPaths.length <= 1) {
        continue;
      }

      const assigned = new Map();
      const maxDepth = Math.max(...groupedPaths.map((path) => splitPath(path).length));
      for (let depth = 2; depth <= maxDepth; depth += 1) {
        const candidates = new Map();
        for (const filePath of groupedPaths) {
          if (assigned.has(filePath)) {
            continue;
          }
          const parts = splitPath(filePath);
          const suffix = parts.slice(-Math.min(depth, parts.length)).join("/");
          if (!candidates.has(suffix)) {
            candidates.set(suffix, []);
          }
          candidates.get(suffix).push(filePath);
        }

        for (const [suffix, paths] of candidates.entries()) {
          if (paths.length === 1) {
            assigned.set(paths[0], suffix);
          }
        }
      }

      for (const filePath of groupedPaths) {
        namesByPath.set(filePath, assigned.get(filePath) || filePath);
      }
    }

    return namesByPath;
  }

  function isEditMode() {
    const { editTab } = getEditorElements();
    return editTab?.classList.contains("active") || false;
  }

  function createTabData(filePath) {
    return {
      filePath,
      content: "",
      lastSavedContent: "",
      isDirty: false,
      isEditMode: false,
      editorScrollTop: 0,
      previewScrollTop: 0,
      isLoaded: false,
      saveTimeout: null,
      isSaving: false,
      hasExternalConflict: false,
    };
  }

  function getTabData(filePath) {
    if (!filePath) {
      return null;
    }
    return tabsState.tabs.get(filePath) || null;
  }

  function getActiveTab() {
    return getTabData(tabsState.activeTabPath);
  }

  function replaceTabPath(oldPath, newPath) {
    if (!oldPath || !newPath || oldPath === newPath) {
      return oldPath;
    }
    const tabData = tabsState.tabs.get(oldPath);
    if (!tabData) {
      return oldPath;
    }

    tabsState.tabs.delete(oldPath);
    tabData.filePath = newPath;
    tabsState.tabs.set(newPath, tabData);
    tabsState.tabOrder = tabsState.tabOrder.map((path) => (path === oldPath ? newPath : path));
    if (tabsState.activeTabPath === oldPath) {
      tabsState.activeTabPath = newPath;
    }
    return newPath;
  }

  function renderTabBar() {
    const bar = document.getElementById("file-tabs-bar");
    if (!bar) {
      return;
    }

    if (!tabsState.enabled) {
      bar.classList.add("hidden");
      bar.innerHTML = "";
      return;
    }

    bar.classList.remove("hidden");
    bar.innerHTML = "";
    const names = displayNameMap();

    for (const filePath of tabsState.tabOrder) {
      const tabData = tabsState.tabs.get(filePath);
      if (!tabData) {
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "file-tab";
      button.setAttribute("role", "tab");
      button.setAttribute("data-path", filePath);
      button.setAttribute("aria-selected", String(filePath === tabsState.activeTabPath));
      button.setAttribute("title", filePath);
      if (filePath === tabsState.activeTabPath) {
        button.classList.add("active");
      }

      const name = document.createElement("span");
      name.className = "file-tab-name";
      name.textContent = names.get(filePath) || basename(filePath);

      const dirty = document.createElement("span");
      dirty.className = "file-tab-dirty";
      dirty.textContent = "•";
      if (!tabData.isDirty) {
        dirty.classList.add("hidden");
      }

      const close = document.createElement("span");
      close.className = "file-tab-close";
      close.textContent = "×";
      close.setAttribute("role", "button");
      close.setAttribute("tabindex", "0");
      close.setAttribute("aria-label", `Close ${names.get(filePath) || basename(filePath)}`);
      close.setAttribute("title", "Close tab");

      close.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeTab(filePath);
      });
      close.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          closeTab(filePath);
        }
      });

      button.addEventListener("click", () => {
        switchTab(filePath);
      });

      button.appendChild(name);
      button.appendChild(dirty);
      button.appendChild(close);
      bar.appendChild(button);
    }
  }

  function setModeClasses(tabName) {
    const { editTab, previewTab, editorContainer, previewContainer } = getEditorElements();
    if (!editTab || !previewTab || !editorContainer || !previewContainer) {
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
  }

  function saveCurrentTabState(filePath = tabsState.activeTabPath) {
    const tabData = getTabData(filePath);
    if (!tabData) {
      return;
    }

    const { editor, previewContainer } = getEditorElements();
    if (editor) {
      tabData.content = editor.value;
      tabData.editorScrollTop = editor.scrollTop;
    }
    if (previewContainer) {
      tabData.previewScrollTop = previewContainer.scrollTop;
    }
    tabData.isEditMode = isEditMode();
    tabData.isDirty = tabData.content !== tabData.lastSavedContent;
    renderTabBar();
  }

  async function showCloseDirtyTabDialog(fileName) {
    return new Promise((resolve) => {
      const modal = document.getElementById("close-tab-modal");
      const overlay = document.getElementById("close-tab-overlay");
      const message = document.getElementById("close-tab-message");
      const saveButton = document.getElementById("close-tab-save");
      const discardButton = document.getElementById("close-tab-discard");
      const cancelButton = document.getElementById("close-tab-cancel");

      if (!modal || !overlay || !message || !saveButton || !discardButton || !cancelButton) {
        resolve("cancel");
        return;
      }

      message.textContent = `"${fileName}" has unsaved changes. What would you like to do?`;
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

  async function checkForExternalChanges(filePath = null) {
    const targetPath = filePath || tabsState.activeTabPath;
    const tabData = getTabData(targetPath);
    if (!targetPath || !tabData) {
      return false;
    }

    try {
      const response = await fetch(`/api/content?file=${encodeURIComponent(targetPath)}`);
      if (!response.ok) {
        return false;
      }
      const payload = await response.json();
      return (payload.content || "") !== tabData.lastSavedContent;
    } catch (error) {
      console.error("Failed to check for external changes.", error);
      return false;
    }
  }

  async function loadTabContent(filePath, options = {}) {
    const { force = false } = options;
    const tabData = getTabData(filePath);
    if (!tabData) {
      return false;
    }
    if (tabData.isLoaded && !force) {
      return true;
    }

    setContentLoadingState(true);
    try {
      const response = await fetch(`/api/content?file=${encodeURIComponent(filePath)}`);
      if (!response.ok) {
        throw new Error(`Failed to load content (${response.status})`);
      }

      const payload = await response.json();
      tabData.content = payload.content || "";
      tabData.lastSavedContent = tabData.content;
      tabData.isDirty = false;
      tabData.hasExternalConflict = false;
      tabData.isLoaded = true;
      return true;
    } catch (error) {
      console.error("Failed to load tab content.", error);
      setSaveStatus("Load failed", "error");
      return false;
    } finally {
      setContentLoadingState(false);
    }
  }

  async function reloadTab(filePath = null) {
    const targetPath = filePath || tabsState.activeTabPath;
    const tabData = getTabData(targetPath);
    if (!targetPath || !tabData) {
      return false;
    }

    const loaded = await loadTabContent(targetPath, { force: true });
    if (!loaded) {
      return false;
    }

    if (targetPath === tabsState.activeTabPath) {
      const { editor, previewContainer } = getEditorElements();
      if (editor) {
        editor.value = tabData.content;
      }
      if (tabData.isEditMode) {
        editor?.scrollTo({ top: tabData.editorScrollTop, behavior: "auto" });
      } else {
        await window.renderMarkdown(tabData.content);
        previewContainer?.scrollTo({ top: tabData.previewScrollTop, behavior: "auto" });
      }
      setSaveStatus("Reloaded from disk", "saved");
    }

    renderTabBar();
    return true;
  }

  function updateTabDirtyState(filePath = null) {
    const targetPath = filePath || tabsState.activeTabPath;
    const tabData = getTabData(targetPath);
    if (!tabData) {
      return false;
    }

    const { editor } = getEditorElements();
    if (targetPath === tabsState.activeTabPath && editor) {
      tabData.content = editor.value;
    }
    tabData.isDirty = tabData.content !== tabData.lastSavedContent;
    renderTabBar();
    return tabData.isDirty;
  }

  async function saveTabContent(filePath = null) {
    let targetPath = filePath || tabsState.activeTabPath;
    const tabData = getTabData(targetPath);
    if (!targetPath || !tabData || tabData.isSaving) {
      return false;
    }

    const { editor } = getEditorElements();
    if (targetPath === tabsState.activeTabPath && editor) {
      tabData.content = editor.value;
    }
    tabData.isDirty = tabData.content !== tabData.lastSavedContent;
    if (!tabData.isDirty) {
      setSaveStatus("Saved", "saved");
      return true;
    }

    if (tabData.saveTimeout) {
      window.clearTimeout(tabData.saveTimeout);
      tabData.saveTimeout = null;
    }

    tabData.isSaving = true;
    setSaveStatus("Saving...", "saving");
    try {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: tabData.content,
          file: targetPath,
        }),
      });

      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }

      const payload = await response.json();
      const relativePath = payload.metadata?.relative_path || targetPath;
      targetPath = replaceTabPath(targetPath, relativePath);

      const nextTabData = getTabData(targetPath);
      if (!nextTabData) {
        return false;
      }
      nextTabData.lastSavedContent = nextTabData.content;
      nextTabData.isDirty = false;
      nextTabData.hasExternalConflict = false;

      if (tabsState.activeTabPath === targetPath) {
        setPageTitle(targetPath);
        window.fileTree?.setCurrentFile?.(targetPath);
      }

      renderTabBar();
      setSaveStatus("Saved", "saved");
      return true;
    } catch (error) {
      console.error("Failed to save tab content.", error);
      setSaveStatus("Save failed", "error");
      return false;
    } finally {
      const nextTabData = getTabData(targetPath);
      if (nextTabData) {
        nextTabData.isSaving = false;
      }
    }
  }

  function queueTabAutosave(filePath = null) {
    const targetPath = filePath || tabsState.activeTabPath;
    const tabData = getTabData(targetPath);
    if (!targetPath || !tabData) {
      return;
    }

    if (tabData.saveTimeout) {
      window.clearTimeout(tabData.saveTimeout);
    }
    tabData.saveTimeout = window.setTimeout(() => {
      saveTabContent(targetPath);
    }, AUTOSAVE_DELAY_MS);
  }

  async function restoreTabToEditor(filePath) {
    const tabData = getTabData(filePath);
    const { editor, previewContainer } = getEditorElements();
    if (!tabData || !editor) {
      return false;
    }

    editor.value = tabData.content;
    setModeClasses(tabData.isEditMode ? "edit" : "preview");
    if (tabData.isEditMode) {
      editor.scrollTo({ top: tabData.editorScrollTop, behavior: "auto" });
      return true;
    }

    await window.renderMarkdown(tabData.content);
    previewContainer?.scrollTo({ top: tabData.previewScrollTop, behavior: "auto" });
    return true;
  }

  async function resolveBackgroundConflict(tabData) {
    if (!tabData.hasExternalConflict || !tabData.isDirty) {
      return true;
    }

    const choice = await window.showConflictDialog?.();
    if (choice === "save") {
      return saveTabContent(tabData.filePath);
    }
    if (choice === "discard") {
      return reloadTab(tabData.filePath);
    }
    return false;
  }

  async function switchTab(filePath, options = {}) {
    const { skipCurrentSave = false } = options;
    if (!tabsState.enabled || !filePath || !tabsState.tabs.has(filePath)) {
      return false;
    }

    if (tabsState.activeTabPath === filePath) {
      return true;
    }

    const targetTab = getTabData(filePath);
    if (!targetTab) {
      return false;
    }

    const targetResolved = await resolveBackgroundConflict(targetTab);
    if (!targetResolved) {
      return false;
    }

    const currentPath = tabsState.activeTabPath;
    const currentTab = getTabData(currentPath);
    if (!skipCurrentSave && currentTab) {
      saveCurrentTabState(currentPath);
      if (currentTab.isDirty) {
        const hasConflict = await checkForExternalChanges(currentPath);
        if (hasConflict) {
          const choice = await window.showConflictDialog?.();
          if (choice === "save") {
            const saved = await saveTabContent(currentPath);
            if (!saved) {
              return false;
            }
          } else if (choice === "discard") {
            const reloaded = await reloadTab(currentPath);
            if (!reloaded) {
              return false;
            }
          } else {
            return false;
          }
        } else {
          const saved = await saveTabContent(currentPath);
          if (!saved) {
            return false;
          }
        }
      }
    }

    const loaded = await loadTabContent(filePath);
    if (!loaded) {
      return false;
    }

    tabsState.activeTabPath = filePath;
    await restoreTabToEditor(filePath);
    setPageTitle(filePath);
    window.fileTree?.setCurrentFile?.(filePath);
    setSaveStatus("Loaded", "saved");
    renderTabBar();
    return true;
  }

  function clearEditor() {
    const { editor } = getEditorElements();
    if (editor) {
      editor.value = "";
      editor.scrollTo({ top: 0, behavior: "auto" });
    }
    setModeClasses("preview");
    window.renderMarkdown?.("");
    setPageTitle(null);
    setSaveStatus("Select a file");
    window.fileTree?.setCurrentFile?.(null);
    renderTabBar();
  }

  async function openTab(filePath) {
    if (!tabsState.enabled || !filePath) {
      return false;
    }

    if (tabsState.tabs.has(filePath)) {
      return switchTab(filePath);
    }

    if (tabsState.tabs.size >= MAX_OPEN_TABS) {
      setSaveStatus("Close a tab to open more files", "error");
      return false;
    }

    tabsState.tabs.set(filePath, createTabData(filePath));
    tabsState.tabOrder.push(filePath);
    renderTabBar();
    const switched = await switchTab(filePath);
    if (!switched) {
      tabsState.tabs.delete(filePath);
      tabsState.tabOrder = tabsState.tabOrder.filter((path) => path !== filePath);
      renderTabBar();
      return false;
    }
    return true;
  }

  async function closeTab(filePath) {
    const tabData = getTabData(filePath);
    if (!tabData) {
      return false;
    }

    if (tabData.isDirty) {
      const choice = await showCloseDirtyTabDialog(basename(filePath));
      if (choice === "save") {
        const saved = await saveTabContent(filePath);
        if (!saved) {
          return false;
        }
      } else if (choice === "cancel") {
        return false;
      }
    }

    if (tabData.saveTimeout) {
      window.clearTimeout(tabData.saveTimeout);
      tabData.saveTimeout = null;
    }

    const index = tabsState.tabOrder.indexOf(filePath);
    const wasActive = tabsState.activeTabPath === filePath;
    tabsState.tabs.delete(filePath);
    tabsState.tabOrder = tabsState.tabOrder.filter((path) => path !== filePath);

    if (!wasActive) {
      renderTabBar();
      return true;
    }

    const replacementPath = tabsState.tabOrder[index] || tabsState.tabOrder[index - 1] || null;
    tabsState.activeTabPath = null;

    if (!replacementPath) {
      clearEditor();
      return true;
    }
    return switchTab(replacementPath, { skipCurrentSave: true });
  }

  async function setActiveMode(tabName) {
    if (!tabsState.enabled) {
      return false;
    }

    const tabData = getActiveTab();
    const { editor, previewContainer } = getEditorElements();
    if (!tabData || !editor) {
      return false;
    }

    saveCurrentTabState(tabData.filePath);

    if (tabName === "edit") {
      tabData.isEditMode = true;
      setModeClasses("edit");
      editor.scrollTo({ top: tabData.editorScrollTop, behavior: "auto" });
      return true;
    }

    if (tabName !== "preview") {
      return false;
    }

    tabData.content = editor.value;
    tabData.isDirty = tabData.content !== tabData.lastSavedContent;
    if (tabData.isDirty) {
      const hasConflict = await checkForExternalChanges(tabData.filePath);
      if (hasConflict) {
        const choice = await window.showConflictDialog?.();
        if (choice === "save") {
          const saved = await saveTabContent(tabData.filePath);
          if (!saved) {
            return false;
          }
        } else if (choice === "discard") {
          const reloaded = await reloadTab(tabData.filePath);
          if (!reloaded) {
            return false;
          }
        } else {
          return false;
        }
      } else {
        const saved = await saveTabContent(tabData.filePath);
        if (!saved) {
          return false;
        }
      }
    }

    tabData.isEditMode = false;
    setModeClasses("preview");
    tabData.content = editor.value;
    await window.renderMarkdown(tabData.content);
    previewContainer?.scrollTo({ top: tabData.previewScrollTop, behavior: "auto" });
    renderTabBar();
    return true;
  }

  async function handleExternalChange(detail) {
    if (!tabsState.enabled || !detail || typeof detail.file !== "string") {
      return;
    }
    if (typeof detail.content !== "string") {
      return;
    }

    const tabData = getTabData(detail.file);
    if (!tabData) {
      return;
    }

    if (detail.file !== tabsState.activeTabPath) {
      if (tabData.isDirty) {
        tabData.hasExternalConflict = true;
      } else {
        tabData.content = detail.content;
        tabData.lastSavedContent = detail.content;
        tabData.isDirty = false;
        tabData.hasExternalConflict = false;
        tabData.isLoaded = true;
      }
      renderTabBar();
      return;
    }

    const { editor } = getEditorElements();
    if (!editor) {
      return;
    }

    tabData.isEditMode = isEditMode();
    if (detail.content === editor.value) {
      return;
    }

    if (!tabData.isEditMode) {
      editor.value = detail.content;
      tabData.content = detail.content;
      tabData.lastSavedContent = detail.content;
      tabData.isDirty = false;
      tabData.hasExternalConflict = false;
      await window.renderMarkdown(detail.content);
      setSaveStatus("Reloaded from disk", "saved");
      renderTabBar();
      return;
    }

    const hasUnsavedChanges = editor.value !== tabData.lastSavedContent;
    if (!hasUnsavedChanges) {
      editor.value = detail.content;
      tabData.content = detail.content;
      tabData.lastSavedContent = detail.content;
      tabData.isDirty = false;
      tabData.hasExternalConflict = false;
      setSaveStatus("Reloaded from disk", "saved");
      renderTabBar();
      return;
    }

    const shouldReload = window.confirm(
      "This file was changed externally and you have unsaved changes. Reload and discard your changes?",
    );
    if (!shouldReload) {
      tabData.hasExternalConflict = true;
      setSaveStatus("External change ignored");
      renderTabBar();
      return;
    }

    editor.value = detail.content;
    tabData.content = detail.content;
    tabData.lastSavedContent = detail.content;
    tabData.isDirty = false;
    tabData.hasExternalConflict = false;
    setSaveStatus("Reloaded from disk", "saved");
    renderTabBar();
  }

  function bindScrollState() {
    if (tabsState.scrollBound) {
      return;
    }

    const { editor, previewContainer } = getEditorElements();
    if (editor) {
      editor.addEventListener("scroll", () => {
        const active = getActiveTab();
        if (active) {
          active.editorScrollTop = editor.scrollTop;
        }
      });
    }
    if (previewContainer) {
      previewContainer.addEventListener("scroll", () => {
        const active = getActiveTab();
        if (active) {
          active.previewScrollTop = previewContainer.scrollTop;
        }
      });
    }
    tabsState.scrollBound = true;
  }

  function init(mode) {
    tabsState.enabled = mode === "folder";
    if (!tabsState.enabled) {
      tabsState.tabs.clear();
      tabsState.tabOrder = [];
      tabsState.activeTabPath = null;
      renderTabBar();
      return;
    }

    bindScrollState();
    renderTabBar();
  }

  window.fileTabs = {
    openTab,
    switchTab,
    closeTab,
    isEnabled: () => tabsState.enabled,
    getActiveTabPath: () => tabsState.activeTabPath,
    getTabData,
    handleExternalChange,
    saveCurrentTabState,
    queueTabAutosave,
    updateTabDirtyState,
    saveTabContent,
    setActiveMode,
    checkForExternalChanges,
    reloadTab,
    init,
  };
})();
