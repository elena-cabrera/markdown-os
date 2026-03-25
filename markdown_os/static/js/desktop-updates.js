(() => {
  function state() {
    return window.markdownOSDesktop || null;
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
    if (!desktopState?.isDesktop) {
      return;
    }

    const container = document.getElementById("desktop-update-banner");
    const text = document.getElementById("desktop-update-text");
    const downloadButton = document.getElementById("desktop-update-download");
    const dismissButton = document.getElementById("desktop-update-dismiss");

    if (!container || !text || !downloadButton || !dismissButton) {
      return;
    }

    if (!desktopState.updateInfo?.version || !desktopState.updateInfo?.url) {
      container.classList.add("hidden");
      return;
    }

    text.textContent = `Update available: ${desktopState.updateInfo.version}`;
    container.classList.remove("hidden");

    downloadButton.onclick = () => {
      void window.electronDesktop?.openExternalUrl?.(desktopState.updateInfo.url);
    };

    dismissButton.onclick = async () => {
      const version = desktopState.updateInfo?.version;
      await dismissVersion(version);
      await desktopState.checkForUpdates?.();
      container.classList.add("hidden");
    };
  }

  window.markdownOSDesktopUpdates = {
    refreshUpdateBanner,
  };
})();
