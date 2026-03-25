(() => {
  // #region agent log
  function debugLog(hypothesisId, location, message, data = {}) {
    try {
      window.electronDesktop?.debugLog?.({ hypothesisId, location, message, data });
    } catch (_error) {}
  }
  // #endregion

  const desktopState = {
    enabled: false,
    snapshot: {
      mode: "file",
      workspacePath: null,
      currentFile: null,
      isEmptyWorkspace: false,
    },
  };

  function isDesktop() {
    return Boolean(window.electronDesktop);
  }

  async function fetchDesktopState() {
    if (!isDesktop()) {
      return { ...desktopState.snapshot };
    }

    const response = await fetch("/api/desktop/state");
    if (!response.ok) {
      throw new Error(`Failed to load desktop state (${response.status})`);
    }

    const payload = await response.json();
    // #region agent log
    debugLog("A", "desktop-shell.js:27", "Fetched desktop state", {
      mode: payload.mode || "empty",
      hasWorkspacePath: Boolean(payload.workspacePath),
      hasCurrentFile: Boolean(payload.currentFile),
      isEmptyWorkspace: Boolean(payload.isEmptyWorkspace),
    });
    // #endregion
    desktopState.snapshot = {
      mode: payload.mode || "empty",
      workspacePath: payload.workspacePath || null,
      currentFile: payload.currentFile || null,
      isEmptyWorkspace: Boolean(payload.isEmptyWorkspace),
    };
    return { ...desktopState.snapshot };
  }

  function setSnapshot(snapshot) {
    desktopState.snapshot = {
      mode: snapshot?.mode || "empty",
      workspacePath: snapshot?.workspacePath || null,
      currentFile: snapshot?.currentFile || null,
      isEmptyWorkspace: Boolean(snapshot?.isEmptyWorkspace),
    };
    // #region agent log
    debugLog("A", "desktop-shell.js:43", "Set desktop snapshot", {
      mode: desktopState.snapshot.mode,
      hasWorkspacePath: Boolean(desktopState.snapshot.workspacePath),
      hasCurrentFile: Boolean(desktopState.snapshot.currentFile),
      isEmptyWorkspace: desktopState.snapshot.isEmptyWorkspace,
    });
    // #endregion
    window.dispatchEvent(
      new CustomEvent("markdown-os:desktop-state", {
        detail: { ...desktopState.snapshot },
      }),
    );
  }

  async function openWorkspace(path) {
    if (!isDesktop() || !path) {
      return null;
    }

    const requestPath = String(path);
    const endpoint = /\.(md|markdown)$/i.test(requestPath)
      ? "/api/desktop/open-file"
      : "/api/desktop/open-folder";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: requestPath }),
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.detail || `${endpoint} failed (${response.status})`);
    }

    const payload = await response.json();
    setSnapshot(payload);
    return payload;
  }

  async function closeWorkspace() {
    if (!isDesktop()) {
      return null;
    }

    const response = await fetch("/api/desktop/close-workspace", {
      method: "POST",
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(
        errorPayload.detail || `Failed to close workspace (${response.status})`,
      );
    }

    const payload = await response.json();
    setSnapshot(payload);
    return payload;
  }

  function getSnapshot() {
    return { ...desktopState.snapshot };
  }

  document.addEventListener("DOMContentLoaded", async () => {
    desktopState.enabled = isDesktop();
    // #region agent log
    debugLog("D", "desktop-shell.js:99", "Desktop shell DOMContentLoaded", {
      enabled: desktopState.enabled,
      hasElectronDesktop: Boolean(window.electronDesktop),
      hasMarkdownOSDesktop: Boolean(window.markdownOSDesktop),
      hasMarkdownOSNamespace: Boolean(window.MarkdownOS),
    });
    // #endregion
    document.documentElement.classList.toggle("desktop-app", desktopState.enabled);
    if (!desktopState.enabled) {
      return;
    }

    try {
      const snapshot = await fetchDesktopState();
      setSnapshot(snapshot);
    } catch (error) {
      console.error("Failed to initialize desktop shell.", error);
    }
  });

  window.MarkdownOS = window.MarkdownOS || {};
  window.MarkdownOS.desktopShell = {
    isDesktop,
    fetchDesktopState,
    openWorkspace,
    closeWorkspace,
    getSnapshot,
    setSnapshot,
  };
})();
