(() => {
  /**
   * Returns the heading level (1–6) if the selection is inside a heading within the editor, otherwise 0.
   *
   * @returns {number}
   */
  function getCurrentHeadingLevel() {
    const editor = document.getElementById("wysiwyg-editor");
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      return 0;
    }
    let node = selection.anchorNode;
    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test(node.tagName)) {
        return Number(node.tagName[1]);
      }
      node = node.parentElement;
    }
    return 0;
  }

  function updateInlineButtonState() {
    const headingLevel = getCurrentHeadingLevel();

    document.querySelectorAll(".toolbar-button[data-command]").forEach((button) => {
      const command = button.dataset.command;
      if (!command) {
        return;
      }

      let active = false;
      if (command === "bold") {
        active = headingLevel === 0 && document.queryCommandState("bold");
      } else if (command === "italic") {
        active = document.queryCommandState("italic");
      } else if (command === "strike") {
        active = document.queryCommandState("strikeThrough");
      } else if (command === "h1" || command === "h2" || command === "h3") {
        const level = command === "h1" ? 1 : command === "h2" ? 2 : 3;
        active = headingLevel === level;
      } else if (command === "bulletList") {
        active = document.queryCommandState("insertUnorderedList");
      } else if (command === "orderedList") {
        active = document.queryCommandState("insertOrderedList");
      }

      button.classList.toggle("active", Boolean(active));
    });
  }

  function closeFormatMenu() {
    const menu = document.getElementById("format-menu");
    const toggle = document.getElementById("format-menu-toggle");
    if (!menu || !toggle) {
      return;
    }

    menu.classList.add("hidden");
    toggle.setAttribute("aria-expanded", "false");
  }

  function bindFormatMenu() {
    const menu = document.getElementById("format-menu");
    const toggle = document.getElementById("format-menu-toggle");
    if (!menu || !toggle) {
      return;
    }

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isHidden = menu.classList.contains("hidden");
      if (isHidden) {
        menu.classList.remove("hidden");
        toggle.setAttribute("aria-expanded", "true");
        return;
      }

      closeFormatMenu();
    });

    menu.addEventListener("click", async (event) => {
      const button = event.target.closest(".format-menu-item[data-command]");
      if (!button) {
        return;
      }

      event.preventDefault();
      const command = button.dataset.command;
      if (!command) {
        return;
      }

      if (window.wysiwyg?.exec) {
        await window.wysiwyg.exec(command);
      }
      closeFormatMenu();
      updateInlineButtonState();
    });

    document.addEventListener("click", (event) => {
      if (menu.classList.contains("hidden")) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (menu.contains(target) || toggle.contains(target)) {
        return;
      }
      closeFormatMenu();
    });
  }

  function bindToolbarButtons() {
    document.querySelectorAll(".toolbar-button[data-command]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const command = button.dataset.command;
        if (!command || !window.wysiwyg?.exec) {
          return;
        }

        await window.wysiwyg.exec(command);
        updateInlineButtonState();
      });
    });
  }

  function bindHistoryButtons() {
    const undoButton = document.getElementById("undo-button");
    const redoButton = document.getElementById("redo-button");

    undoButton?.addEventListener("click", (event) => {
      event.preventDefault();
      window.wysiwyg?.undo?.();
      updateInlineButtonState();
    });

    redoButton?.addEventListener("click", (event) => {
      event.preventDefault();
      window.wysiwyg?.redo?.();
      updateInlineButtonState();
    });
  }

  function bindKeyboardShortcuts() {
    document.addEventListener("keydown", async (event) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const hasPrimaryModifier = isMac ? event.metaKey : event.ctrlKey;
      if (!hasPrimaryModifier) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        if (window.wysiwyg?.exec) {
          await window.wysiwyg.exec("link");
          updateInlineButtonState();
        }
      } else if (key === "e") {
        event.preventDefault();
        if (window.wysiwyg?.exec) {
          await window.wysiwyg.exec("inlineCode");
          updateInlineButtonState();
        }
      }
    });
  }

  document.addEventListener("selectionchange", () => {
    const active = document.activeElement;
    if (!(active instanceof Element) || active.id !== "wysiwyg-editor") {
      return;
    }
    updateInlineButtonState();
  });

  document.addEventListener("DOMContentLoaded", () => {
    bindToolbarButtons();
    bindHistoryButtons();
    bindFormatMenu();
    bindKeyboardShortcuts();
    updateInlineButtonState();
  });
})();
