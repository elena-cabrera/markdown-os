(() => {
  const toolbarState = {
    initialized: false,
    buttonRecords: [],
  };

  function getEditor() {
    return window.wysiwyg?.getEditor?.() || null;
  }

  function runEditorCommand(command) {
    const editor = getEditor();
    if (!editor) {
      return;
    }
    command(editor);
    syncButtonStates();
  }

  function syncButtonStates() {
    const editor = getEditor();
    if (!editor) {
      return;
    }

    toolbarState.buttonRecords.forEach((record) => {
      if (!record.isActive) {
        return;
      }
      const active = record.isActive(editor);
      record.button.classList.toggle("active", active);
      record.button.setAttribute("aria-pressed", String(active));
    });
  }

  function createButton(definition) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wysiwyg-toolbar-button";
    button.textContent = definition.label;
    button.setAttribute("aria-label", definition.title);
    button.title = definition.title;

    button.addEventListener("click", () => {
      runEditorCommand(definition.command);
    });

    return button;
  }

  function promptForLink(editor) {
    const currentUrl = editor.getAttributes("link").href || "";
    const linkUrl = window.prompt("Link URL", currentUrl || "https://");
    if (!linkUrl) {
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: linkUrl })
      .run();
  }

  function promptForImage(editor) {
    const imageUrl = window.prompt("Image URL", "https://");
    if (!imageUrl) {
      return;
    }
    editor.chain().focus().setImage({ src: imageUrl, alt: "image" }).run();
  }

  function toolbarDefinitions() {
    return [
      {
        label: "B",
        title: "Bold (Ctrl+B)",
        command: (editor) => editor.chain().focus().toggleBold().run(),
        isActive: (editor) => editor.isActive("bold"),
      },
      {
        label: "I",
        title: "Italic (Ctrl+I)",
        command: (editor) => editor.chain().focus().toggleItalic().run(),
        isActive: (editor) => editor.isActive("italic"),
      },
      {
        label: "~S~",
        title: "Strikethrough",
        command: (editor) => editor.chain().focus().toggleStrike().run(),
        isActive: (editor) => editor.isActive("strike"),
      },
      {
        label: "`code`",
        title: "Inline code",
        command: (editor) => editor.chain().focus().toggleCode().run(),
        isActive: (editor) => editor.isActive("code"),
      },
      { separator: true },
      {
        label: "H1",
        title: "Heading 1",
        command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: (editor) => editor.isActive("heading", { level: 1 }),
      },
      {
        label: "H2",
        title: "Heading 2",
        command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: (editor) => editor.isActive("heading", { level: 2 }),
      },
      {
        label: "H3",
        title: "Heading 3",
        command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: (editor) => editor.isActive("heading", { level: 3 }),
      },
      { separator: true },
      {
        label: "•",
        title: "Bullet list",
        command: (editor) => editor.chain().focus().toggleBulletList().run(),
        isActive: (editor) => editor.isActive("bulletList"),
      },
      {
        label: "1.",
        title: "Ordered list",
        command: (editor) => editor.chain().focus().toggleOrderedList().run(),
        isActive: (editor) => editor.isActive("orderedList"),
      },
      {
        label: "☑",
        title: "Task list",
        command: (editor) => editor.chain().focus().toggleTaskList().run(),
        isActive: (editor) => editor.isActive("taskList"),
      },
      { separator: true },
      {
        label: "❝",
        title: "Blockquote",
        command: (editor) => editor.chain().focus().toggleBlockquote().run(),
        isActive: (editor) => editor.isActive("blockquote"),
      },
      {
        label: "—",
        title: "Horizontal rule",
        command: (editor) => editor.chain().focus().setHorizontalRule().run(),
      },
      {
        label: "{ }",
        title: "Code block",
        command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
        isActive: (editor) => editor.isActive("codeBlock"),
      },
      { separator: true },
      {
        label: "link",
        title: "Insert or edit link",
        command: (editor) => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          promptForLink(editor);
        },
        isActive: (editor) => editor.isActive("link"),
      },
      {
        label: "img",
        title: "Insert image by URL",
        command: (editor) => {
          promptForImage(editor);
        },
      },
      {
        label: "tbl",
        title: "Insert table",
        command: () => {
          window.wysiwyg?.insertTable?.();
        },
      },
      { separator: true },
      {
        label: "↶",
        title: "Undo",
        command: (editor) => editor.chain().focus().undo().run(),
      },
      {
        label: "↷",
        title: "Redo",
        command: (editor) => editor.chain().focus().redo().run(),
      },
    ];
  }

  function renderToolbar() {
    const container = document.getElementById("wysiwyg-toolbar");
    if (!container) {
      return;
    }

    container.innerHTML = "";
    toolbarState.buttonRecords = [];

    toolbarDefinitions().forEach((definition) => {
      if (definition.separator) {
        const separator = document.createElement("span");
        separator.className = "wysiwyg-toolbar-separator";
        separator.setAttribute("aria-hidden", "true");
        container.appendChild(separator);
        return;
      }

      const button = createButton(definition);
      container.appendChild(button);
      toolbarState.buttonRecords.push({
        button,
        isActive: definition.isActive || null,
      });
    });
  }

  function init() {
    if (toolbarState.initialized) {
      return;
    }

    renderToolbar();
    toolbarState.initialized = true;
    syncButtonStates();

    window.wysiwyg?.addSelectionUpdateListener?.(() => {
      syncButtonStates();
    });
    window.wysiwyg?.addMarkdownUpdateListener?.(() => {
      syncButtonStates();
    });
  }

  window.wysiwygToolbar = {
    init,
    syncButtonStates,
  };
})();
