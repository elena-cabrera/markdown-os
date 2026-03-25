(() => {
  const PICKER_EMPTY_FILENAME = "Untitled.md";

  // #region agent log
  function debugLog(hypothesisId, location, message, data = {}) {
    try {
      window.electronDesktop?.debugLog?.({ hypothesisId, location, message, data });
    } catch (_error) {}
  }
  // #endregion

  function isDesktopMode() {
    return window.desktopShell?.isDesktop?.() === true;
  }

  function pickerRoot() {
    return document.getElementById("desktop-picker");
  }

  function emptyStateRoot() {
    return document.getElementById("empty-state");
  }

  function emptyStateButton() {
    return document.getElementById("empty-state-primary-action");
  }

  function setPickerVisibility(visible) {
    const root = pickerRoot();
    // #region agent log
    debugLog("B", "desktop-picker.js:28", "Set picker visibility", {
      requestedVisible: Boolean(visible),
      hasPickerRoot: Boolean(root),
      pickerRootId: root?.id || null,
    });
    // #endregion
    if (!root) {
      return;
    }
    root.classList.toggle("hidden", !visible);
  }

  function setEmptyFolderActionVisible(visible) {
    const button = emptyStateButton();
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    button.classList.toggle("hidden", !visible);
  }

  function setEmptyStateCopy(title, subtitle) {
    const titleNode = document.querySelector("#empty-state .empty-state-title");
    const subtitleNode = document.querySelector("#empty-state .empty-state-subtitle");
    if (titleNode) {
      titleNode.textContent = title;
    }
    if (subtitleNode) {
      subtitleNode.textContent = subtitle;
    }
  }

  function recentItemMarkup(item) {
    const safeName = item?.name || item?.path || "";
    const safePath = item?.path || "";
    const typeLabel = item?.type === "folder" ? "Folder" : "File";
    return `
      <button
        type="button"
        class="desktop-recent-item"
        data-recent-path="${safePath}"
        data-recent-type="${item?.type || "file"}"
      >
        <span class="desktop-recent-name">${safeName}</span>
        <span class="desktop-recent-meta">${typeLabel} · ${safePath}</span>
      </button>
    `;
  }

  async function renderRecents() {
    const fileList = document.getElementById("desktop-recent-files");
    const folderList = document.getElementById("desktop-recent-folders");
    if (!fileList || !folderList) {
      return;
    }

    if (!isDesktopMode()) {
      fileList.innerHTML = "";
      folderList.innerHTML = "";
      return;
    }

    const recents = await window.electronDesktop?.listRecents?.();
    const recentItems = Array.isArray(recents) ? recents : [];
    const files = recentItems.filter((item) => item.type === "file");
    const folders = recentItems.filter((item) => item.type === "folder");

    fileList.innerHTML = files.length
      ? files.map(recentItemMarkup).join("")
      : '<p class="desktop-empty-recents">No recent files</p>';
    folderList.innerHTML = folders.length
      ? folders.map(recentItemMarkup).join("")
      : '<p class="desktop-empty-recents">No recent folders</p>';
  }

  async function refreshPicker() {
    await renderRecents();
    setPickerVisibility(window.desktopShell?.isPickerVisible?.() === true);
  }

  async function openRecent(path, type) {
    if (!path || !type) {
      return false;
    }
    if (type === "folder") {
      return window.desktopShell?.openDesktopFolder?.(path);
    }
    return window.desktopShell?.openDesktopFile?.(path);
  }

  async function promptForFirstNote() {
    const filename = await window.markdownDialogs?.prompt?.({
      title: "Create first note",
      message: "Enter a filename for the first markdown note in this folder.",
      label: "Filename",
      value: PICKER_EMPTY_FILENAME,
      confirmText: "Create",
    });
    return filename?.trim() || null;
  }

  async function createFirstNote() {
    const snapshot = window.desktopShell?.snapshot?.();
    if (!snapshot || snapshot.mode !== "folder") {
      return false;
    }

    const filename = await promptForFirstNote();
    if (!filename) {
      return false;
    }

    try {
      const response = await fetch("/api/files/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filename }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create file (${response.status})`);
      }
      const payload = await response.json();
      await window.fileTree?.loadFileTree?.();
      if (window.fileTabs?.isEnabled?.()) {
        await window.fileTabs.openTab(payload.path);
      } else if (typeof window.switchFile === "function") {
        await window.switchFile(payload.path);
      }
      return true;
    } catch (error) {
      console.error("Failed to create first note.", error);
      return false;
    }
  }

  function handlePickerClick(event) {
    const target = event.target instanceof Element ? event.target.closest(".desktop-recent-item") : null;
    if (!target) {
      return;
    }
    openRecent(
      target.getAttribute("data-recent-path"),
      target.getAttribute("data-recent-type"),
    );
  }

  function bindPickerActions() {
    document.getElementById("desktop-open-file")?.addEventListener("click", async () => {
      await window.desktopShell?.pickAndOpenFile?.();
      await refreshPicker();
    });

    document.getElementById("desktop-open-folder")?.addEventListener("click", async () => {
      await window.desktopShell?.pickAndOpenFolder?.();
      await refreshPicker();
    });

    pickerRoot()?.addEventListener("click", handlePickerClick);

    emptyStateButton()?.addEventListener("click", async () => {
      await createFirstNote();
    });

    window.addEventListener("markdown-os:desktop-state", async (event) => {
      const snapshot = event.detail || {};
      // #region agent log
      debugLog("A", "desktop-picker.js:186", "Desktop state event received", {
        mode: snapshot.mode || null,
        isEmptyWorkspace: snapshot.isEmptyWorkspace === true,
        hasPickerVisibleApi: typeof window.desktopShell?.isPickerVisible === "function",
      });
      // #endregion
      const showPicker = snapshot.mode === "empty";
      setPickerVisibility(showPicker);
      const isEmptyWorkspace = snapshot.mode === "folder" && snapshot.isEmptyWorkspace === true;
      setEmptyFolderActionVisible(isEmptyWorkspace);
      if (isEmptyWorkspace) {
        setEmptyStateCopy(
          "This folder has no markdown files yet",
          "Create the first note to start editing this workspace.",
        );
      } else {
        setEmptyStateCopy("No file selected", "Select a file from the sidebar to open it.");
      }
      await renderRecents();
    });
  }

  function init() {
    // #region agent log
    debugLog("A", "desktop-picker.js:204", "Desktop picker init", {
      hasEmptyStateRoot: Boolean(emptyStateRoot()),
      hasPickerRoot: Boolean(pickerRoot()),
      pickerRootId: pickerRoot()?.id || null,
      hasDesktopShellGlobal: Boolean(window.desktopShell),
      hasMarkdownOSDesktop: Boolean(window.markdownOSDesktop),
    });
    // #endregion
    if (!emptyStateRoot()) {
      return;
    }
    bindPickerActions();
    setEmptyFolderActionVisible(false);
    refreshPicker();
  }

  window.desktopPicker = {
    createFirstNote,
    init,
    refreshPicker,
    setEmptyFolderActionVisible,
    setPickerVisibility,
  };

  document.addEventListener("DOMContentLoaded", init);
})();
