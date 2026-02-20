(() => {
  const wysiwygState = {
    editor: null,
    markdownListeners: new Set(),
    selectionListeners: new Set(),
    headingShortcutCleanup: null,
  };

  function editorElement() {
    return document.getElementById("wysiwyg-editor");
  }

  function scrollContainer() {
    return document.getElementById("wysiwyg-container");
  }

  function tiptapBundle() {
    return window.MarkdownOSTipTap || null;
  }

  function withEditor(fn, fallback = null) {
    if (!wysiwygState.editor) {
      return fallback;
    }
    return fn(wysiwygState.editor);
  }

  function detachHeadingShortcutHandler() {
    if (!wysiwygState.headingShortcutCleanup) {
      return;
    }
    wysiwygState.headingShortcutCleanup();
    wysiwygState.headingShortcutCleanup = null;
  }

  function attachHeadingShortcutHandler(editor) {
    const editorDom = editor?.view?.dom;
    if (!editorDom) {
      return;
    }

    const handleKeydown = (event) => {
      if (
        event.key !== " " ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const selection = editor.state.selection;
      if (!selection.empty) {
        return;
      }

      const { $from } = selection;
      const parentNode = $from.parent;
      if (!parentNode?.isTextblock || parentNode.type.name !== "paragraph") {
        return;
      }

      const shortcutText = parentNode.textBetween(0, $from.parentOffset, undefined, "");
      if (!/^#{1,3}$/.test(shortcutText)) {
        return;
      }

      event.preventDefault();
      const blockStart = $from.start();
      const level = shortcutText.length;
      editor
        .chain()
        .focus()
        .deleteRange({ from: blockStart, to: blockStart + level })
        .toggleHeading({ level })
        .run();
    };

    editorDom.addEventListener("keydown", handleKeydown);
    wysiwygState.headingShortcutCleanup = () => {
      editorDom.removeEventListener("keydown", handleKeydown);
    };
  }

  function init(options = {}) {
    const bundle = tiptapBundle();
    const targetElement = editorElement();
    if (!bundle || !targetElement) {
      return null;
    }

    detachHeadingShortcutHandler();
    if (wysiwygState.editor) {
      wysiwygState.editor.destroy();
    }

    wysiwygState.markdownListeners.clear();
    wysiwygState.selectionListeners.clear();
    if (typeof options.onMarkdownUpdate === "function") {
      wysiwygState.markdownListeners.add(options.onMarkdownUpdate);
    }
    if (typeof options.onSelectionUpdate === "function") {
      wysiwygState.selectionListeners.add(options.onSelectionUpdate);
    }

    const editor = bundle.createTipTapEditor({
      element: targetElement,
      content: options.content || "",
      editable: options.editable !== false,
      onUploadImage: options.onUploadImage || null,
      onUploadStart: options.onUploadStart || null,
      onUploadEnd: options.onUploadEnd || null,
      onUpdate: ({ editor: activeEditor }) => {
        const markdown = bundle.getMarkdown(activeEditor);
        for (const listener of wysiwygState.markdownListeners) {
          listener(markdown, activeEditor);
        }
      },
      onSelectionUpdate: ({ editor: activeEditor }) => {
        for (const listener of wysiwygState.selectionListeners) {
          listener(activeEditor);
        }
      },
    });

    wysiwygState.editor = editor;
    attachHeadingShortcutHandler(editor);
    return editor;
  }

  function getEditor() {
    return wysiwygState.editor;
  }

  function getMarkdown() {
    const bundle = tiptapBundle();
    if (!bundle || !wysiwygState.editor) {
      return "";
    }
    return bundle.getMarkdown(wysiwygState.editor);
  }

  function setMarkdown(markdown, options = {}) {
    const bundle = tiptapBundle();
    if (!bundle || !wysiwygState.editor) {
      return;
    }
    const { emitUpdate = false } = options;
    bundle.setMarkdown(wysiwygState.editor, markdown || "", emitUpdate);
  }

  function focus() {
    withEditor((editor) => editor.commands.focus());
  }

  function setEditable(editable) {
    withEditor((editor) => editor.setEditable(Boolean(editable)));
  }

  function addSelectionUpdateListener(handler) {
    if (typeof handler !== "function") {
      return () => {};
    }
    wysiwygState.selectionListeners.add(handler);
    return () => {
      wysiwygState.selectionListeners.delete(handler);
    };
  }

  function addMarkdownUpdateListener(handler) {
    if (typeof handler !== "function") {
      return () => {};
    }
    wysiwygState.markdownListeners.add(handler);
    return () => {
      wysiwygState.markdownListeners.delete(handler);
    };
  }

  function getScrollTop() {
    return scrollContainer()?.scrollTop || 0;
  }

  function setScrollTop(value) {
    const container = scrollContainer();
    if (!container) {
      return;
    }
    container.scrollTop = Math.max(0, value || 0);
  }

  function insertTable() {
    withEditor((editor) => {
      editor
        .chain()
        .focus()
        .insertTable({
          rows: 3,
          cols: 3,
          withHeaderRow: true,
        })
        .run();
    });
  }

  function insertInlineMath() {
    const bundle = tiptapBundle();
    withEditor((editor) => {
      bundle?.insertInlineMathSyntax(editor);
    });
  }

  function insertDisplayMath() {
    const bundle = tiptapBundle();
    withEditor((editor) => {
      bundle?.insertDisplayMathSyntax(editor);
    });
  }

  function rerenderMermaid() {
    const bundle = tiptapBundle();
    const root = editorElement();
    if (!bundle || !root) {
      return;
    }
    bundle.rerenderMermaidNodeViews(root);
  }

  function closeMermaidFullscreen() {
    tiptapBundle()?.closeFullscreenMermaid?.();
  }

  window.addEventListener("markdown-os:theme-changed", () => {
    closeMermaidFullscreen();
    rerenderMermaid();
  });

  window.wysiwyg = {
    init,
    getEditor,
    getMarkdown,
    setMarkdown,
    focus,
    setEditable,
    addSelectionUpdateListener,
    addMarkdownUpdateListener,
    getScrollTop,
    setScrollTop,
    insertTable,
    insertInlineMath,
    insertDisplayMath,
    rerenderMermaid,
  };
})();
