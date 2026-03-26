(() => {
  const PICKER_EMPTY_FILENAME = "Untitled.md";

  function desktopShell() {
    return window.MarkdownOS?.desktopShell || null;
  }

  function isDesktopMode() {
    return desktopShell()?.isDesktop?.() === true;
  }

  function pickerOverlay() {
    return document.getElementById("desktop-picker-overlay");
  }

  function pickerModal() {
    return document.getElementById("desktop-picker-modal");
  }

  function emptyStateRoot() {
    return document.getElementById("empty-state");
  }

  function emptyStateButton() {
    return document.getElementById("empty-state-primary-action");
  }

  function workspaceControlsRoot() {
    return document.getElementById("desktop-open-workspace-controls");
  }

  /**
   * Electron preload returns a path string or null; some callers may use { canceled, path }.
   *
   * @param {unknown} result
   * @returns {string | null}
   */
  function pathFromNativePickerResult(result) {
    if (result == null) {
      return null;
    }
    if (typeof result === "string") {
      return result;
    }
    if (typeof result === "object" && result !== null && "path" in result) {
      const candidate = /** @type {{ canceled?: boolean; path?: string }} */ (result);
      if (candidate.canceled) {
        return null;
      }
      return typeof candidate.path === "string" ? candidate.path : null;
    }
    return null;
  }

  function setPickerVisibility(visible) {
    const overlay = pickerOverlay();
    const modal = pickerModal();
    if (!overlay || !modal) {
      return;
    }
    overlay.classList.toggle("hidden", !visible);
    modal.classList.toggle("hidden", !visible);
    overlay.setAttribute("aria-hidden", visible ? "false" : "true");
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
        <div class="desktop-recent-main">
          <p class="desktop-recent-name">${safeName}</p>
          <p class="desktop-recent-path">${safePath}</p>
        </div>
        <span class="desktop-recent-type">${typeLabel}</span>
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
      : '<p class="desktop-recents-empty">No recent files</p>';
    folderList.innerHTML = folders.length
      ? folders.map(recentItemMarkup).join("")
      : '<p class="desktop-recents-empty">No recent folders</p>';
  }

  async function refreshPicker() {
    await renderRecents();
    const snapshot = desktopShell()?.getSnapshot?.();
    setPickerVisibility(snapshot?.mode === "empty");
  }

  async function openRecent(path, type) {
    if (!path || !type) {
      return false;
    }
    return desktopShell()?.openWorkspace?.(path);
  }

  async function promptAndOpenWorkspace() {
    try {
      const raw = await window.electronDesktop?.pickPath?.();
      const selectedPath = pathFromNativePickerResult(raw);
      if (selectedPath) {
        await desktopShell()?.openWorkspace?.(selectedPath);
      }
    } catch (error) {
      console.error("Failed to open workspace from picker.", error);
    }
    await refreshPicker();
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
    const snapshot = desktopShell()?.getSnapshot?.();
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

  async function handlePickerClick(event) {
    const target = event.target instanceof Element ? event.target.closest(".desktop-recent-item") : null;
    if (!target) {
      return;
    }
    const path = target.getAttribute("data-recent-path");
    const type = target.getAttribute("data-recent-type");
    try {
      await openRecent(path, type);
    } catch (error) {
      console.error("Failed to open recent workspace.", error);
    }
    await refreshPicker();
  }

  function bindPickerActions() {
    document.getElementById("desktop-open-file")?.addEventListener("click", async () => {
      try {
        const raw = await window.electronDesktop?.pickFile?.();
        const selectedPath = pathFromNativePickerResult(raw);
        if (selectedPath) {
          await desktopShell()?.openWorkspace?.(selectedPath);
        }
      } catch (error) {
        console.error("Failed to open file from picker.", error);
      }
      await refreshPicker();
    });

    document.getElementById("desktop-open-folder")?.addEventListener("click", async () => {
      try {
        const raw = await window.electronDesktop?.pickFolder?.();
        const selectedPath = pathFromNativePickerResult(raw);
        if (selectedPath) {
          await desktopShell()?.openWorkspace?.(selectedPath);
        }
      } catch (error) {
        console.error("Failed to open folder from picker.", error);
      }
      await refreshPicker();
    });

    document.getElementById("desktop-open-workspace-icon")?.addEventListener("click", async () => {
      await promptAndOpenWorkspace();
    });

    document.getElementById("desktop-open-workspace-button")?.addEventListener("click", async () => {
      await promptAndOpenWorkspace();
    });

    pickerModal()?.addEventListener("click", handlePickerClick);

    emptyStateButton()?.addEventListener("click", async () => {
      await createFirstNote();
    });

    window.addEventListener("markdown-os:desktop-state", async (event) => {
      const snapshot = event.detail || {};
      const showPicker = snapshot.mode === "empty";
      setPickerVisibility(showPicker);
      if (snapshot.mode === "folder") {
        const isEmptyWorkspace = snapshot.isEmptyWorkspace === true;
        setEmptyFolderActionVisible(isEmptyWorkspace);
        if (isEmptyWorkspace) {
          setEmptyStateCopy(
            "This folder has no markdown files yet",
            "Create the first note to start editing this workspace.",
          );
        } else {
          setEmptyStateCopy("No file selected", "Select a file from the sidebar to open it.");
        }
      } else {
        setEmptyFolderActionVisible(false);
      }
      await renderRecents();
    });
  }

  function init() {
    if (!emptyStateRoot()) {
      return;
    }
    bindPickerActions();
    setEmptyFolderActionVisible(false);
    const workspaceControls = workspaceControlsRoot();
    if (workspaceControls && isDesktopMode()) {
      workspaceControls.classList.remove("hidden");
    }
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
