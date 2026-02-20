(() => {
  const THEME_KEY = "markdown-os-theme";
  const HIGHLIGHT_THEME_BASE =
    "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles";
  const DROPDOWN_CLOSE_ANIMATION_MS = 140;
  const THEMES = [
    {
      id: "light",
      name: "Default Light",
      type: "light",
      dots: ["#f7f8fa", "#17233b", "#2563eb"],
      highlightTheme: "github",
      mermaidTheme: "default",
    },
    {
      id: "dark",
      name: "Default Dark",
      type: "dark",
      dots: ["#0f172a", "#e2e8f0", "#60a5fa"],
      highlightTheme: "github-dark",
      mermaidTheme: "dark",
    },
    {
      id: "dracula",
      name: "Dracula",
      type: "dark",
      dots: ["#282a36", "#f8f8f2", "#bd93f9"],
      highlightTheme: "base16/dracula",
      mermaidTheme: "dark",
    },
    {
      id: "nord-light",
      name: "Nord Light",
      type: "light",
      dots: ["#eceff4", "#2e3440", "#5e81ac"],
      highlightTheme: "github",
      mermaidTheme: "neutral",
    },
    {
      id: "nord-dark",
      name: "Nord Dark",
      type: "dark",
      dots: ["#2e3440", "#eceff4", "#88c0d0"],
      highlightTheme: "nord",
      mermaidTheme: "dark",
    },
    {
      id: "lofi",
      name: "Lofi",
      type: "light",
      dots: ["#f5f5f5", "#333333", "#555555"],
      highlightTheme: "grayscale",
      mermaidTheme: "neutral",
    },
  ];
  const themeById = new Map(THEMES.map((theme) => [theme.id, theme]));

  class ThemeManager {
    constructor() {
      this.currentThemeId = null;
      this.dropdownCloseTimer = null;
      this.isDropdownOpen = false;
      this.systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

      this.dropdownRoot = document.getElementById("theme-dropdown");
      this.toggleButton = document.getElementById("theme-dropdown-toggle");
      this.dropdownMenu = document.getElementById("theme-dropdown-menu");
      this.dropdownDots = document.getElementById("theme-dots");
      this.highlightTheme = document.getElementById("highlight-theme");

      this.boundOnToggleClick = this.onToggleClick.bind(this);
      this.boundOnToggleKeyDown = this.onToggleKeyDown.bind(this);
      this.boundOnDropdownMenuClick = this.onDropdownMenuClick.bind(this);
      this.boundOnDropdownMenuKeyDown = this.onDropdownMenuKeyDown.bind(this);
      this.boundOnDocumentPointerDown = this.onDocumentPointerDown.bind(this);
      this.boundOnDocumentKeyDown = this.onDocumentKeyDown.bind(this);
    }

    init() {
      const savedTheme = this.readSavedTheme();
      const initialThemeId = savedTheme ?? this.detectSystemTheme();
      if (!savedTheme) {
        this.persistTheme(initialThemeId);
      }

      this.renderDropdown();
      this.applyTheme(initialThemeId, { emitThemeEvent: false });
      this.bindEvents();
      window.setTimeout(() => {
        document.documentElement.classList.remove("loading");
      }, 100);
    }

    readSavedTheme() {
      try {
        const storedTheme = window.localStorage.getItem(THEME_KEY);
        if (themeById.has(storedTheme)) {
          return storedTheme;
        }
      } catch (error) {
        return null;
      }

      return null;
    }

    persistTheme(themeId) {
      try {
        window.localStorage.setItem(THEME_KEY, themeId);
      } catch (error) {
        // Ignore storage failures (private browsing or blocked storage).
      }
    }

    detectSystemTheme() {
      return this.systemQuery.matches ? "dark" : "light";
    }

    resolveThemeId(themeId) {
      if (themeById.has(themeId)) {
        return themeId;
      }
      return this.detectSystemTheme();
    }

    bindEvents() {
      if (this.toggleButton) {
        this.toggleButton.addEventListener("click", this.boundOnToggleClick);
        this.toggleButton.addEventListener("keydown", this.boundOnToggleKeyDown);
      }

      if (this.dropdownMenu) {
        this.dropdownMenu.addEventListener("click", this.boundOnDropdownMenuClick);
        this.dropdownMenu.addEventListener("keydown", this.boundOnDropdownMenuKeyDown);
      }

      document.addEventListener("pointerdown", this.boundOnDocumentPointerDown);
      document.addEventListener("keydown", this.boundOnDocumentKeyDown);
    }

    renderDropdown() {
      if (!this.dropdownMenu) {
        return;
      }

      this.dropdownMenu.innerHTML = "";
      THEMES.forEach((theme) => {
        const item = document.createElement("li");
        item.className = "theme-dropdown-item";
        item.id = this.getDropdownItemId(theme.id);
        item.dataset.themeId = theme.id;
        item.setAttribute("role", "option");
        item.setAttribute("tabindex", "-1");
        item.setAttribute("aria-selected", "false");

        const swatch = document.createElement("span");
        swatch.className = "theme-dropdown-item-dots";
        theme.dots.forEach((dotColor) => {
          const dot = document.createElement("span");
          dot.className = "theme-dropdown-item-dot";
          dot.style.backgroundColor = dotColor;
          swatch.appendChild(dot);
        });

        const label = document.createElement("span");
        label.className = "theme-dropdown-item-label";
        label.textContent = theme.name;

        const check = document.createElement("span");
        check.className = "theme-dropdown-check";
        check.setAttribute("aria-hidden", "true");
        check.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7L9 18l-5-5"></path></svg>';

        item.appendChild(swatch);
        item.appendChild(label);
        item.appendChild(check);
        this.dropdownMenu.appendChild(item);
      });

      this.syncDropdownState();
    }

    getDropdownItemId(themeId) {
      return `theme-option-${themeId}`;
    }

    getDropdownItems() {
      if (!this.dropdownMenu) {
        return [];
      }
      return Array.from(this.dropdownMenu.querySelectorAll(".theme-dropdown-item"));
    }

    getSelectedThemeIndex() {
      const selectedIndex = THEMES.findIndex(
        (theme) => theme.id === this.currentThemeId,
      );
      return selectedIndex >= 0 ? selectedIndex : 0;
    }

    getFocusedThemeIndex() {
      const items = this.getDropdownItems();
      const activeElement = document.activeElement;
      if (!(activeElement instanceof Element)) {
        return this.getSelectedThemeIndex();
      }
      const focusedItem = activeElement.closest(".theme-dropdown-item");
      if (!focusedItem || !this.dropdownMenu?.contains(focusedItem)) {
        return this.getSelectedThemeIndex();
      }
      const focusedIndex = items.indexOf(focusedItem);
      return focusedIndex >= 0 ? focusedIndex : this.getSelectedThemeIndex();
    }

    focusThemeAt(index) {
      const items = this.getDropdownItems();
      if (items.length === 0) {
        return;
      }

      const safeIndex = ((index % items.length) + items.length) % items.length;
      const itemToFocus = items[safeIndex];
      items.forEach((item, itemIndex) => {
        item.setAttribute("tabindex", itemIndex === safeIndex ? "0" : "-1");
      });
      itemToFocus.focus();

      if (this.dropdownMenu) {
        this.dropdownMenu.setAttribute("aria-activedescendant", itemToFocus.id);
      }
    }

    moveThemeFocus(direction) {
      const items = this.getDropdownItems();
      if (items.length === 0) {
        return;
      }

      const currentIndex = this.getFocusedThemeIndex();
      this.focusThemeAt(currentIndex + direction);
    }

    syncDropdownState() {
      if (!this.dropdownMenu) {
        return;
      }

      const items = this.getDropdownItems();
      let selectedItem = null;
      items.forEach((item) => {
        const isActive = item.dataset.themeId === this.currentThemeId;
        item.classList.toggle("active", isActive);
        item.setAttribute("aria-selected", isActive ? "true" : "false");
        if (isActive) {
          selectedItem = item;
        }
      });

      if (!selectedItem) {
        this.dropdownMenu.removeAttribute("aria-activedescendant");
        return;
      }

      this.dropdownMenu.setAttribute("aria-activedescendant", selectedItem.id);
      items.forEach((item) => {
        item.setAttribute("tabindex", item === selectedItem ? "0" : "-1");
      });
    }

    selectTheme(themeId) {
      const resolvedThemeId = this.resolveThemeId(themeId);
      this.persistTheme(resolvedThemeId);
      this.applyTheme(resolvedThemeId);
      this.closeDropdown({ restoreFocus: true });
    }

    applyTheme(themeId, options = {}) {
      const { emitThemeEvent = true } = options;
      const resolvedThemeId = this.resolveThemeId(themeId);
      const nextTheme = themeById.get(resolvedThemeId);
      if (!nextTheme) {
        return;
      }

      const didChange = resolvedThemeId !== this.currentThemeId;
      this.currentThemeId = resolvedThemeId;
      document.documentElement.setAttribute("data-theme", resolvedThemeId);

      this.updateToggleButton(nextTheme);
      this.updateHighlightTheme(nextTheme.highlightTheme);
      this.syncDropdownState();

      if (didChange && emitThemeEvent) {
        this.updateMermaidTheme(nextTheme);
      }
    }

    updateToggleButton(theme) {
      if (this.dropdownDots) {
        this.dropdownDots.innerHTML = "";
        theme.dots.forEach((dotColor) => {
          const dot = document.createElement("span");
          dot.className = "theme-dot";
          dot.style.backgroundColor = dotColor;
          this.dropdownDots.appendChild(dot);
        });
      }

      if (!this.toggleButton) {
        return;
      }

      this.toggleButton.setAttribute(
        "aria-label",
        `Select theme (current: ${theme.name})`,
      );
      this.toggleButton.setAttribute("title", `Theme: ${theme.name}`);
    }

    updateHighlightTheme(highlightThemeId) {
      if (!this.highlightTheme) {
        return;
      }

      const highlightHref = `${HIGHLIGHT_THEME_BASE}/${highlightThemeId}.min.css`;
      if (this.highlightTheme.getAttribute("href") === highlightHref) {
        return;
      }

      this.highlightTheme.setAttribute("href", highlightHref);
    }

    updateMermaidTheme(theme) {
      window.dispatchEvent(
        new CustomEvent("markdown-os:theme-changed", {
          detail: {
            theme: theme.id,
            mermaidTheme: theme.mermaidTheme,
          },
        }),
      );

      // NodeViews listen to the event, but this explicit call keeps theme switches
      // responsive when the editor was initialized after the event listener.
      window.wysiwyg?.rerenderMermaid?.();
    }

    openDropdown(options = {}) {
      const { focus = "selected" } = options;
      if (!this.dropdownRoot || !this.dropdownMenu || !this.toggleButton) {
        return;
      }

      if (this.isDropdownOpen) {
        return;
      }

      if (this.dropdownCloseTimer) {
        window.clearTimeout(this.dropdownCloseTimer);
        this.dropdownCloseTimer = null;
      }

      this.isDropdownOpen = true;
      this.dropdownMenu.hidden = false;
      this.toggleButton.setAttribute("aria-expanded", "true");
      window.requestAnimationFrame(() => {
        this.dropdownRoot?.classList.add("open");
      });

      const items = this.getDropdownItems();
      if (items.length === 0) {
        return;
      }

      if (focus === "first") {
        this.focusThemeAt(0);
      } else if (focus === "last") {
        this.focusThemeAt(items.length - 1);
      } else {
        this.focusThemeAt(this.getSelectedThemeIndex());
      }
    }

    closeDropdown(options = {}) {
      const { restoreFocus = false } = options;
      if (!this.isDropdownOpen) {
        return;
      }

      this.isDropdownOpen = false;
      this.dropdownRoot?.classList.remove("open");
      this.toggleButton?.setAttribute("aria-expanded", "false");

      if (this.dropdownCloseTimer) {
        window.clearTimeout(this.dropdownCloseTimer);
      }

      this.dropdownCloseTimer = window.setTimeout(() => {
        if (!this.isDropdownOpen && this.dropdownMenu) {
          this.dropdownMenu.hidden = true;
        }
      }, DROPDOWN_CLOSE_ANIMATION_MS);

      if (restoreFocus) {
        this.toggleButton?.focus();
      }
    }

    onToggleClick() {
      if (this.isDropdownOpen) {
        this.closeDropdown({ restoreFocus: false });
        return;
      }
      this.openDropdown({ focus: "selected" });
    }

    onToggleKeyDown(event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.openDropdown({ focus: "first" });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.openDropdown({ focus: "last" });
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (this.isDropdownOpen) {
          this.closeDropdown({ restoreFocus: true });
        } else {
          this.openDropdown({ focus: "selected" });
        }
        return;
      }

      if (event.key === "Escape" && this.isDropdownOpen) {
        event.preventDefault();
        this.closeDropdown({ restoreFocus: true });
      }
    }

    onDropdownMenuClick(event) {
      if (!(event.target instanceof Element)) {
        return;
      }

      const item = event.target.closest(".theme-dropdown-item");
      if (!item || !this.dropdownMenu?.contains(item)) {
        return;
      }

      const selectedThemeId = item.dataset.themeId;
      if (!selectedThemeId) {
        return;
      }

      this.selectTheme(selectedThemeId);
    }

    onDropdownMenuKeyDown(event) {
      if (!this.isDropdownOpen) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.moveThemeFocus(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.moveThemeFocus(-1);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        this.focusThemeAt(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        this.focusThemeAt(this.getDropdownItems().length - 1);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const focusedIndex = this.getFocusedThemeIndex();
        const focusedItem = this.getDropdownItems()[focusedIndex];
        const selectedThemeId = focusedItem?.dataset.themeId;
        if (!selectedThemeId) {
          return;
        }
        this.selectTheme(selectedThemeId);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        this.closeDropdown({ restoreFocus: true });
        return;
      }

      if (event.key === "Tab") {
        this.closeDropdown({ restoreFocus: false });
      }
    }

    onDocumentPointerDown(event) {
      if (!this.isDropdownOpen || !this.dropdownRoot) {
        return;
      }

      if (event.target instanceof Node && this.dropdownRoot.contains(event.target)) {
        return;
      }

      this.closeDropdown({ restoreFocus: false });
    }

    onDocumentKeyDown(event) {
      if (event.key !== "Escape" || !this.isDropdownOpen) {
        return;
      }
      event.preventDefault();
      this.closeDropdown({ restoreFocus: true });
    }
  }

  const themeManager = new ThemeManager();
  themeManager.init();
  window.markdownOSThemeManager = themeManager;
})();
