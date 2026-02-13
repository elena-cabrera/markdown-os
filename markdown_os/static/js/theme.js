(() => {
  const THEME_KEY = "markdown-os-theme";
  const THEME_LIGHT = "light";
  const THEME_DARK = "dark";

  class ThemeManager {
    constructor() {
      this.currentTheme = null;
      this.hasManualPreference = false;
      this.systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

      this.toggleButton = document.getElementById("theme-toggle");
      this.sunIcon = document.getElementById("theme-icon-sun");
      this.moonIcon = document.getElementById("theme-icon-moon");
      this.highlightLight = document.getElementById("highlight-light");
      this.highlightDark = document.getElementById("highlight-dark");
    }

    init() {
      const savedTheme = this.readSavedTheme();
      if (savedTheme) {
        this.hasManualPreference = true;
        this.applyTheme(savedTheme);
      } else {
        this.applyTheme(this.detectSystemTheme());
      }

      if (this.toggleButton) {
        this.toggleButton.addEventListener("click", () => this.toggleTheme());
      }

      this.watchSystemPreference();
      window.setTimeout(() => {
        document.documentElement.classList.remove("loading");
      }, 100);
    }

    readSavedTheme() {
      try {
        const storedTheme = window.localStorage.getItem(THEME_KEY);
        if (storedTheme === THEME_LIGHT || storedTheme === THEME_DARK) {
          return storedTheme;
        }
      } catch (error) {
        return null;
      }

      return null;
    }

    persistTheme(theme) {
      try {
        window.localStorage.setItem(THEME_KEY, theme);
      } catch (error) {
        // Ignore storage failures (private browsing or blocked storage).
      }
    }

    detectSystemTheme() {
      return this.systemQuery.matches ? THEME_DARK : THEME_LIGHT;
    }

    watchSystemPreference() {
      const handleChange = (event) => {
        if (this.hasManualPreference) {
          return;
        }

        this.applyTheme(event.matches ? THEME_DARK : THEME_LIGHT);
      };

      if (typeof this.systemQuery.addEventListener === "function") {
        this.systemQuery.addEventListener("change", handleChange);
        return;
      }

      if (typeof this.systemQuery.addListener === "function") {
        this.systemQuery.addListener(handleChange);
      }
    }

    toggleTheme() {
      const nextTheme =
        this.currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;

      this.hasManualPreference = true;
      this.persistTheme(nextTheme);
      this.applyTheme(nextTheme);
    }

    normalizeTheme(theme) {
      return theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
    }

    applyTheme(theme) {
      const normalizedTheme = this.normalizeTheme(theme);
      const didChange = normalizedTheme !== this.currentTheme;
      this.currentTheme = normalizedTheme;
      document.documentElement.setAttribute("data-theme", normalizedTheme);

      this.updateToggleButton(normalizedTheme);
      this.updateHighlightTheme(normalizedTheme);

      if (didChange) {
        this.updateMermaidTheme(normalizedTheme);
      }
    }

    updateToggleButton(theme) {
      if (this.sunIcon && this.moonIcon) {
        if (theme === THEME_DARK) {
          this.sunIcon.classList.add("hidden");
          this.moonIcon.classList.remove("hidden");
        } else {
          this.sunIcon.classList.remove("hidden");
          this.moonIcon.classList.add("hidden");
        }
      }

      if (!this.toggleButton) {
        return;
      }

      const targetTheme = theme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
      this.toggleButton.setAttribute(
        "aria-label",
        `Switch to ${targetTheme} theme`,
      );
      this.toggleButton.setAttribute("title", `Switch to ${targetTheme} theme`);
      this.toggleButton.setAttribute(
        "aria-pressed",
        theme === THEME_DARK ? "true" : "false",
      );
    }

    updateHighlightTheme(theme) {
      if (!this.highlightLight || !this.highlightDark) {
        return;
      }

      const useDarkTheme = theme === THEME_DARK;
      this.highlightLight.disabled = useDarkTheme;
      this.highlightDark.disabled = !useDarkTheme;
    }

    updateMermaidTheme(theme) {
      window.dispatchEvent(
        new CustomEvent("markdown-os:theme-changed", {
          detail: { theme },
        }),
      );
    }
  }

  const themeManager = new ThemeManager();
  themeManager.init();
  window.markdownOSThemeManager = themeManager;
})();
