(() => {
  let savedEditorSelection = null;

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

  /**
   * Returns whether the current editor selection contains non-empty text.
   *
   * @returns {boolean}
   */
  function hasTextSelection() {
    const editor = document.getElementById("wysiwyg-editor");
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      return false;
    }

    return !range.collapsed && selection.toString().trim().length > 0;
  }

  /**
   * Saves the current editor selection so toolbar clicks can restore it.
   *
   * @returns {void}
   */
  function saveEditorSelection() {
    const editor = document.getElementById("wysiwyg-editor");
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

    savedEditorSelection = range.cloneRange();
  }

  /**
   * Restores the last saved editor selection before running a toolbar command.
   *
   * @returns {boolean} Whether a saved selection was restored.
   */
  function restoreEditorSelection() {
    const editor = document.getElementById("wysiwyg-editor");
    if (!editor || !savedEditorSelection) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    editor.focus();
    selection.removeAllRanges();
    selection.addRange(savedEditorSelection);
    return true;
  }

  /**
   * Returns whether the caret or selection is inside one of the given inline tags.
   *
   * @param {string[]} tagNames
   * @returns {boolean}
   */
  function isSelectionInInlineFormat(tagNames) {
    const editor = document.getElementById("wysiwyg-editor");
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      return false;
    }

    let node = selection.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE && tagNames.includes(node.tagName)) {
        return true;
      }
      node = node.parentElement;
    }

    return false;
  }

  function updateInlineButtonState() {
    const headingLevel = getCurrentHeadingLevel();
    const textFormatToggle = document.getElementById("text-format-menu-toggle");

    document
      .querySelectorAll(".toolbar-button[data-command], .toolbar-submenu-item[data-command]")
      .forEach((button) => {
        const command = button.dataset.command;
        if (!command) {
          return;
        }

        let active = false;
        if (command === "bold") {
          active =
            headingLevel === 0 &&
            (document.queryCommandState("bold") ||
              isSelectionInInlineFormat(["STRONG", "B"]));
        } else if (command === "italic") {
          active =
            document.queryCommandState("italic") ||
            isSelectionInInlineFormat(["EM", "I"]);
        } else if (command === "strike") {
          active =
            document.queryCommandState("strikeThrough") ||
            isSelectionInInlineFormat(["S", "STRIKE", "DEL"]);
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

    if (textFormatToggle) {
      textFormatToggle.classList.toggle("active", headingLevel > 0);
    }
  }

  function closeTextFormatMenu() {
    const menu = document.getElementById("text-format-menu");
    const toggle = document.getElementById("text-format-menu-toggle");
    if (!menu || !toggle) {
      return;
    }

    menu.classList.add("hidden");
    toggle.setAttribute("aria-expanded", "false");
  }

  function bindTextFormatMenu() {
    const menu = document.getElementById("text-format-menu");
    const toggle = document.getElementById("text-format-menu-toggle");
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

      closeTextFormatMenu();
    });

    menu.addEventListener("click", async (event) => {
      const button = event.target.closest(".toolbar-submenu-item[data-command]");
      if (!button) {
        return;
      }

      event.preventDefault();
      const command = button.dataset.command;
      if (!command) {
        return;
      }

      restoreEditorSelection();
      if (window.wysiwyg?.exec) {
        await window.wysiwyg.exec(command);
      }
      closeTextFormatMenu();
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
      closeTextFormatMenu();
    });
  }

  async function runToolbarCommand(command) {
    if (!command || !window.wysiwyg?.exec) {
      return;
    }

    restoreEditorSelection();

    if (command === "code") {
      const resolvedCommand = hasTextSelection() ? "inlineCode" : "codeBlock";
      await window.wysiwyg.exec(resolvedCommand);
      updateInlineButtonState();
      return;
    }

    await window.wysiwyg.exec(command);
    updateInlineButtonState();
  }

  function bindToolbarButtons() {
    const toolbar = document.getElementById("floating-toolbar");
    toolbar?.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) {
        event.preventDefault();
      }
    });

    document.querySelectorAll(".toolbar-button[data-command]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        await runToolbarCommand(button.dataset.command);
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
        await runToolbarCommand("link");
      } else if (key === "e") {
        event.preventDefault();
        await runToolbarCommand("code");
      }
    });
  }

  document.addEventListener("selectionchange", () => {
    saveEditorSelection();

    const editor = document.getElementById("wysiwyg-editor");
    const selection = window.getSelection();
    const selectionInEditor =
      editor &&
      selection &&
      selection.rangeCount > 0 &&
      editor.contains(selection.getRangeAt(0).commonAncestorContainer);

    if (selectionInEditor || document.activeElement?.id === "wysiwyg-editor") {
      updateInlineButtonState();
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    bindToolbarButtons();
    bindHistoryButtons();
    bindTextFormatMenu();
    bindKeyboardShortcuts();
    updateInlineButtonState();
  });
})();
