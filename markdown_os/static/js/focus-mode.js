(() => {
  window.MarkdownOS = window.MarkdownOS || {};

  let isFocusMode = false;
  let cssFallback = false;

  function enter() {
    document.body.classList.add("focus-mode");
    isFocusMode = true;

    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        document.body.classList.add("focus-mode-css-fallback");
        cssFallback = true;
      });
    } else {
      document.body.classList.add("focus-mode-css-fallback");
      cssFallback = true;
    }
  }

  function exit() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    document.body.classList.remove("focus-mode", "focus-mode-css-fallback");
    cssFallback = false;
    isFocusMode = false;
  }

  function toggle() {
    if (isFocusMode) {
      exit();
    } else {
      enter();
    }
  }

  function isActive() {
    return isFocusMode;
  }

  document.addEventListener("fullscreenchange", () => {
    if (isFocusMode && !document.fullscreenElement) {
      exit();
    }
  });

  window.MarkdownOS.focusMode = { toggle, isActive };
})();
