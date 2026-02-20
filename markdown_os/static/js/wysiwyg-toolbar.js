(() => {
  const ICONS = Object.freeze({
    "text-bold":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M5 6c0-1.414 0-2.121.44-2.56C5.878 3 6.585 3 8 3h4.579C15.02 3 17 5.015 17 7.5S15.02 12 12.579 12H5z" clip-rule="evenodd"/><path d="M12.429 12h1.238C16.06 12 18 14.015 18 16.5S16.06 21 13.667 21H8c-1.414 0-2.121 0-2.56-.44C5 20.122 5 19.415 5 18v-6"/></g></svg>',
    "text-italic":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" d="M12 4h7M8 20l8-16M5 20h7"/></svg>',
    "text-strikethrough":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path stroke-linejoin="round" d="M4 12h16"/><path d="M17.5 7.667C17.5 5.089 15.038 3 12 3S6.5 5.09 6.5 7.667c0 .486.053.93.167 1.333M6 16.333C6 18.911 8.686 21 12 21s6-1.333 6-4.667c0-2.393-1.03-3.755-3.092-4.333"/></g></svg>',
    "heading-01":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5v14M14 5v14m3 0h1.5m1.5 0h-1.5m0 0v-8L17 12M4 12h10"/></svg>',
    "heading-02":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.5 5v14m10-14v14m7 0h-4v-.31c0-.438 0-.657.087-.852c.086-.194.249-.34.575-.634l2.605-2.344c.467-.42.733-1.018.733-1.646V13a2 2 0 1 0-4 0v.4M3.5 12h10"/></svg>',
    "heading-03":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.5 5v14m10-14v14m3-2a2 2 0 1 0 2-2a2 2 0 1 0-2-2m-13-1h10"/></svg>',
    "left-to-right-list-bullet":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round"><path stroke-width="1.5" d="M8 5h12"/><path stroke-linejoin="round" stroke-width="2" d="M4 5h.009M4 12h.009M4 19h.009"/><path stroke-width="1.5" d="M8 12h12M8 19h12"/></g></svg>',
    "left-to-right-list-number":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M11 6h10m-10 6h10m-10 6h10"/><path stroke-linejoin="round" d="M3 15h1.5c.279 0 .418 0 .534.023a1.2 1.2 0 0 1 .943.943C6 16.082 6 16.22 6 16.5s0 .418-.023.534a1.2 1.2 0 0 1-.943.943C4.918 18 4.78 18 4.5 18s-.418 0-.534.023a1.2 1.2 0 0 0-.943.943C3 19.082 3 19.22 3 19.5v.9c0 .283 0 .424.088.512s.23.088.512.088H6M3 3h1.2a.3.3 0 0 1 .3.3V9m0 0H3m1.5 0H6"/></g></svg>',
    "check-list":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M11 6h10m-10 6h10m-10 6h10"/><path stroke-linejoin="round" d="M3 7.393S4 8.045 4.5 9C4.5 9 6 5.25 8 4M3 18.393S4 19.045 4.5 20c0 0 1.5-3.75 3.5-5"/></g></svg>',
    math: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 12c0-4.478 0-6.718 1.391-8.109S7.521 2.5 12 2.5c4.478 0 6.718 0 8.109 1.391S21.5 7.521 21.5 12c0 4.478 0 6.718-1.391 8.109S16.479 21.5 12 21.5c-4.478 0-6.718 0-8.109-1.391S2.5 16.479 2.5 12Z"/><path stroke-linecap="round" stroke-linejoin="round" d="m5.5 12.5l.475-.316c.473-.316.71-.474.938-.404c.227.071.333.335.545.864L9 16.5l2.088-6.265c.44-1.32.66-1.98 1.184-2.357s1.22-.378 2.611-.378H18.5M17 12l-1.5 1.5m0 0L14 15m1.5-1.5L17 15m-1.5-1.5L14 12"/></g></svg>',
    "source-code-square":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m16 10l1.227 1.057c.515.445.773.667.773.943s-.258.498-.773.943L16 14m-8-4l-1.227 1.057C6.258 11.502 6 11.724 6 12s.258.498.773.943L8 14m5-5l-2 6"/><path d="M2.5 12c0-4.478 0-6.718 1.391-8.109S7.521 2.5 12 2.5c4.478 0 6.718 0 8.109 1.391S21.5 7.521 21.5 12c0 4.478 0 6.718-1.391 8.109S16.479 21.5 12 21.5c-4.478 0-6.718 0-8.109-1.391S2.5 16.479 2.5 12Z"/></g></svg>',
    "left-to-right-block-quote":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M9 6h8m-8 6h10M9 18h8"/><path stroke-linejoin="round" d="M5 3v18"/></g></svg>',
    "link-04":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M10 13.229q.213.349.504.654a3.56 3.56 0 0 0 4.454.59q.391-.24.73-.59l3.239-3.372c1.43-1.49 1.43-3.904 0-5.394a3.564 3.564 0 0 0-5.183 0l-.714.743"/><path d="m10.97 18.14l-.713.743a3.564 3.564 0 0 1-5.184 0c-1.43-1.49-1.43-3.905 0-5.394l3.24-3.372a3.564 3.564 0 0 1 5.183 0q.291.305.504.654"/></g></svg>',
    table:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.891 20.109C2.5 18.717 2.5 16.479 2.5 12c0-4.478 0-6.718 1.391-8.109S7.521 2.5 12 2.5c4.478 0 6.718 0 8.109 1.391S21.5 7.521 21.5 12c0 4.478 0 6.718-1.391 8.109S16.479 21.5 12 21.5c-4.478 0-6.718 0-8.109-1.391"/><path d="M2.5 9h19m-19 4h19m-19 4h19"/><path stroke-linecap="round" d="M12 21.5V9"/></g></svg>',
    "image-03":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M14 3h-4C6.229 3 4.343 3 3.172 4.172S2 7.229 2 11v2c0 3.771 0 5.657 1.172 6.828S6.229 21 10 21h4c3.771 0 5.657 0 6.828-1.172S22 16.771 22 13v-2c0-3.771 0-5.657-1.172-6.828S17.771 3 14 3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21.5 17l-5.152-5.62a1.17 1.17 0 0 0-1.69-.037L10 16l-2.16-2.16a1.16 1.16 0 0 0-1.686.049L2.5 18"/></g></svg>',
    undo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12a9 9 0 1 0 1.383-4.797m-1.09-4.202l.173 2.054c.124 1.479.186 2.218.668 2.634s1.193.343 2.615.197l2.044-.21"/></svg>',
    redo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 1 1-1.383-4.797m1.09-4.202l-.173 2.054c-.124 1.479-.186 2.218-.668 2.634s-1.193.343-2.615.197l-2.044-.21"/></svg>',
    "horizontal-rule":
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" d="M4 12h16"/></svg>',
    chevron:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="6 9 12 15 18 9"></polyline></svg>',
  });

  const toolbarState = {
    initialized: false,
    buttonRecords: [],
    formatMenuOpen: false,
    formatMenu: {
      container: null,
      toggle: null,
      menu: null,
    },
    globalHandlersBound: false,
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
    toolbarState.buttonRecords.forEach((record) => {
      if (!record.button) {
        return;
      }

      if (!editor) {
        record.button.disabled = true;
        record.button.classList.add("is-disabled");
        record.button.classList.remove("active");
        if (record.isActive) {
          record.button.setAttribute("aria-pressed", "false");
        }
        return;
      }

      if (record.isActive) {
        const active = Boolean(record.isActive(editor));
        record.button.classList.toggle("active", active);
        record.button.setAttribute("aria-pressed", String(active));
      } else {
        record.button.classList.remove("active");
      }

      if (record.isDisabled) {
        const disabled = Boolean(record.isDisabled(editor));
        record.button.disabled = disabled;
        record.button.classList.toggle("is-disabled", disabled);
      } else {
        record.button.disabled = false;
        record.button.classList.remove("is-disabled");
      }
    });
  }

  function createIcon(name, className = "toolbar-icon") {
    const iconMarkup = ICONS[name];
    if (!iconMarkup) {
      return null;
    }

    const template = document.createElement("template");
    template.innerHTML = iconMarkup.trim();
    const icon = template.content.firstElementChild;
    if (!(icon instanceof SVGElement)) {
      return null;
    }
    icon.classList.add(className);
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function createButton(definition, options = {}) {
    const { withLabel = false, className = "wysiwyg-toolbar-button" } = options;
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", definition.title);
    button.title = definition.title;

    const icon = createIcon(definition.icon);
    if (icon) {
      button.appendChild(icon);
    }
    if (withLabel && definition.label) {
      const label = document.createElement("span");
      label.className = "wysiwyg-toolbar-button-label";
      label.textContent = definition.label;
      button.appendChild(label);
    }

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

  function historyDefinitions() {
    return [
      {
        icon: "undo",
        title: "Undo",
        command: (editor) => editor.chain().focus().undo().run(),
      },
      {
        icon: "redo",
        title: "Redo",
        command: (editor) => editor.chain().focus().redo().run(),
      },
    ];
  }

  function floatingToolbarGroups() {
    return [
      [
        {
          icon: "text-bold",
          title: "Bold (Ctrl+B)",
          command: (editor) => editor.chain().focus().toggleBold().run(),
          isActive: (editor) => editor.isActive("bold"),
        },
        {
          icon: "text-italic",
          title: "Italic (Ctrl+I)",
          command: (editor) => editor.chain().focus().toggleItalic().run(),
          isActive: (editor) => editor.isActive("italic"),
        },
        {
          icon: "text-strikethrough",
          title: "Strikethrough",
          command: (editor) => editor.chain().focus().toggleStrike().run(),
          isActive: (editor) => editor.isActive("strike"),
        },
      ],
      [
        {
          icon: "heading-01",
          title: "Heading 1",
          command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          isActive: (editor) => editor.isActive("heading", { level: 1 }),
        },
        {
          icon: "heading-02",
          title: "Heading 2",
          command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          isActive: (editor) => editor.isActive("heading", { level: 2 }),
        },
        {
          icon: "heading-03",
          title: "Heading 3",
          command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          isActive: (editor) => editor.isActive("heading", { level: 3 }),
        },
      ],
      [
        {
          icon: "left-to-right-list-bullet",
          title: "Bullet list",
          command: (editor) => editor.chain().focus().toggleBulletList().run(),
          isActive: (editor) => editor.isActive("bulletList"),
        },
        {
          icon: "left-to-right-list-number",
          title: "Ordered list",
          command: (editor) => editor.chain().focus().toggleOrderedList().run(),
          isActive: (editor) => editor.isActive("orderedList"),
        },
        {
          icon: "check-list",
          title: "Task list",
          command: (editor) => editor.chain().focus().toggleTaskList().run(),
          isActive: (editor) => editor.isActive("taskList"),
        },
        {
          icon: "math",
          title: "Insert display math equation",
          command: () => window.wysiwyg?.insertDisplayMath?.(),
        },
        {
          icon: "source-code-square",
          title: "Code block",
          command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
          isActive: (editor) => editor.isActive("codeBlock"),
        },
        {
          icon: "left-to-right-block-quote",
          title: "Blockquote",
          command: (editor) => editor.chain().focus().toggleBlockquote().run(),
          isActive: (editor) => editor.isActive("blockquote"),
        },
        {
          icon: "link-04",
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
      ],
    ];
  }

  function formatDropdownDefinitions() {
    return [
      {
        label: "Table",
        icon: "table",
        title: "Insert table",
        command: () => {
          window.wysiwyg?.insertTable?.();
        },
      },
      {
        label: "Image",
        icon: "image-03",
        title: "Insert image by URL",
        command: (editor) => {
          promptForImage(editor);
        },
      },
      {
        label: "Inline code",
        icon: "source-code-square",
        title: "Inline code",
        command: (editor) => editor.chain().focus().toggleCode().run(),
        isActive: (editor) => editor.isActive("code"),
      },
      {
        label: "Horizontal rule",
        icon: "horizontal-rule",
        title: "Horizontal rule",
        command: (editor) => editor.chain().focus().setHorizontalRule().run(),
      },
    ];
  }

  function createDivider() {
    const divider = document.createElement("span");
    divider.className = "wysiwyg-toolbar-divider";
    divider.setAttribute("aria-hidden", "true");
    return divider;
  }

  function closeFormatDropdown() {
    if (!toolbarState.formatMenuOpen) {
      return;
    }

    toolbarState.formatMenuOpen = false;
    toolbarState.formatMenu.container?.classList.remove("open");
    toolbarState.formatMenu.menu?.setAttribute("hidden", "");
    toolbarState.formatMenu.toggle?.setAttribute("aria-expanded", "false");
  }

  function openFormatDropdown() {
    if (toolbarState.formatMenuOpen) {
      return;
    }

    toolbarState.formatMenuOpen = true;
    toolbarState.formatMenu.container?.classList.add("open");
    toolbarState.formatMenu.menu?.removeAttribute("hidden");
    toolbarState.formatMenu.toggle?.setAttribute("aria-expanded", "true");
  }

  function toggleFormatDropdown() {
    if (toolbarState.formatMenuOpen) {
      closeFormatDropdown();
      return;
    }
    openFormatDropdown();
  }

  function renderHistoryControls(container) {
    historyDefinitions().forEach((definition) => {
      const button = createButton(definition, { className: "top-toolbar-button" });
      container.appendChild(button);
      toolbarState.buttonRecords.push({
        button,
        isActive: definition.isActive || null,
        isDisabled: definition.isDisabled || null,
      });
    });
  }

  function renderFloatingGroups(container) {
    const groups = floatingToolbarGroups();
    groups.forEach((groupDefinitions, groupIndex) => {
      const group = document.createElement("div");
      group.className = "wysiwyg-toolbar-group";
      groupDefinitions.forEach((definition) => {
        const button = createButton(definition);
        group.appendChild(button);
        toolbarState.buttonRecords.push({
          button,
          isActive: definition.isActive || null,
          isDisabled: definition.isDisabled || null,
        });
      });
      container.appendChild(group);
      if (groupIndex < groups.length - 1) {
        container.appendChild(createDivider());
      }
    });
  }

  function renderFormatDropdown(container) {
    container.appendChild(createDivider());
    const group = document.createElement("div");
    group.className = "wysiwyg-toolbar-group";

    const dropdown = document.createElement("div");
    dropdown.className = "wysiwyg-toolbar-dropdown";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "wysiwyg-toolbar-button wysiwyg-toolbar-dropdown-toggle";
    toggle.setAttribute("aria-label", "More formatting options");
    toggle.title = "More formatting options";
    toggle.setAttribute("aria-haspopup", "menu");
    toggle.setAttribute("aria-expanded", "false");

    const toggleIcon = createIcon("table");
    if (toggleIcon) {
      toggle.appendChild(toggleIcon);
    }
    const toggleLabel = document.createElement("span");
    toggleLabel.className = "wysiwyg-toolbar-button-label";
    toggleLabel.textContent = "Format";
    toggle.appendChild(toggleLabel);
    const chevron = createIcon("chevron", "toolbar-chevron");
    if (chevron) {
      toggle.appendChild(chevron);
    }

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFormatDropdown();
    });

    const menu = document.createElement("div");
    menu.className = "wysiwyg-toolbar-dropdown-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("hidden", "");

    formatDropdownDefinitions().forEach((definition) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "wysiwyg-toolbar-menu-item";
      item.setAttribute("role", "menuitem");
      item.title = definition.title;
      item.setAttribute("aria-label", definition.title);

      const icon = createIcon(definition.icon);
      if (icon) {
        item.appendChild(icon);
      }
      const label = document.createElement("span");
      label.className = "wysiwyg-toolbar-menu-item-label";
      label.textContent = definition.label;
      item.appendChild(label);

      item.addEventListener("click", () => {
        runEditorCommand(definition.command);
        closeFormatDropdown();
      });
      menu.appendChild(item);

      toolbarState.buttonRecords.push({
        button: item,
        isActive: definition.isActive || null,
        isDisabled: definition.isDisabled || null,
      });
    });

    dropdown.appendChild(toggle);
    dropdown.appendChild(menu);
    group.appendChild(dropdown);
    container.appendChild(group);

    toolbarState.formatMenu = {
      container: dropdown,
      toggle,
      menu,
    };
  }

  function bindGlobalHandlers() {
    if (toolbarState.globalHandlersBound) {
      return;
    }
    toolbarState.globalHandlersBound = true;

    document.addEventListener("click", (event) => {
      if (!toolbarState.formatMenuOpen) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && toolbarState.formatMenu.container?.contains(target)) {
        return;
      }
      closeFormatDropdown();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeFormatDropdown();
      }
    });
  }

  function renderToolbar() {
    const historyContainer = document.getElementById("top-toolbar-actions");
    const floatingContainer = document.getElementById("wysiwyg-toolbar");
    if (!historyContainer || !floatingContainer) {
      return;
    }

    closeFormatDropdown();
    historyContainer.innerHTML = "";
    floatingContainer.innerHTML = "";
    toolbarState.buttonRecords = [];
    toolbarState.formatMenu = {
      container: null,
      toggle: null,
      menu: null,
    };

    renderHistoryControls(historyContainer);
    renderFloatingGroups(floatingContainer);
    renderFormatDropdown(floatingContainer);
  }

  function init() {
    if (toolbarState.initialized) {
      return;
    }

    renderToolbar();
    bindGlobalHandlers();
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
