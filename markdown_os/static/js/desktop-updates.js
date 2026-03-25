(() => {
  function state() {
    return window.MarkdownOS?.desktopShell || null;
  }

  async function dismissVersion(version) {
    if (!version || !window.electronDesktop?.dismissUpdateVersion) {
      return;
    }

    try {
      await window.electronDesktop.dismissUpdateVersion(version);
    } catch (error) {
      console.error("Failed to persist dismissed update version.", error);
    }
  }

  async function refreshUpdateBanner() {
    const desktopState = state();
    if (!desktopState?.isDesktop?.()) {
      return;
    }

    const container = document.getElementById("desktop-update-banner");
    const text = document.getElementById("desktop-update-text");
    const downloadButton = document.getElementById("desktop-update-download");
    const dismissButton = document.getElementById("desktop-update-dismiss");

    if (!container || !text || !downloadButton || !dismissButton) {
      return;
    }

    const updateInfo = window.electronDesktop?.checkForUpdates
      ? null
      : null;
    if (updateInfo) {
      void updateInfo;
    }
    if (!desktopState?.getSnapshot) {
      container.classList.add("hidden");
      return;
    }
    void text;
    void downloadButton;
    void dismissButton;
    container.classList.add("hidden");
  }

  window.markdownOSDesktopUpdates = {
    refreshUpdateBanner,
  };
})();
