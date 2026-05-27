(() => {
  const PICKER_EMPTY_FILENAME = "Untitled.md";

  function desktopShell() {
    return window.MarkdownOS?.desktopShell || null;
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

  async function refreshPicker() {
    const snapshot = desktopShell()?.getSnapshot?.();
    setPickerVisibility(snapshot?.mode === "empty");
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

  function bindPickerActions() {
    document.getElementById("desktop-open-file-or-folder")?.addEventListener("click", async () => {
      try {
        const raw = await window.electronDesktop?.pickFileOrFolder?.();
        const selectedPath = pathFromNativePickerResult(raw);
        if (selectedPath) {
          await desktopShell()?.openWorkspace?.(selectedPath);
        }
      } catch (error) {
        console.error("Failed to open from picker.", error);
      }
      await refreshPicker();
    });

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
    });
  }

  function init() {
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
