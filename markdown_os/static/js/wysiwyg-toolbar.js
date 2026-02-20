(() => {
  const BUTTONS = [
    { action: 'bold', label: 'B', title: 'Bold', command: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
    { action: 'italic', label: 'I', title: 'Italic', command: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
    { action: 'strike', label: 'S', title: 'Strikethrough', command: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive('strike') },
    { action: 'code', label: '</>', title: 'Inline code', command: (e) => e.chain().focus().toggleCode().run(), active: (e) => e.isActive('code') },
    { divider: true },
    { action: 'h1', label: 'H1', title: 'Heading 1', command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), active: (e) => e.isActive('heading', { level: 1 }) },
    { action: 'h2', label: 'H2', title: 'Heading 2', command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
    { action: 'bullet', label: '• List', title: 'Bullet list', command: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
    { action: 'ordered', label: '1. List', title: 'Ordered list', command: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
    { action: 'task', label: '☑', title: 'Task list', command: (e) => e.chain().focus().toggleTaskList().run(), active: (e) => e.isActive('taskList') },
    { action: 'quote', label: '❝', title: 'Blockquote', command: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote') },
    { action: 'rule', label: '—', title: 'Horizontal rule', command: (e) => e.chain().focus().setHorizontalRule().run() },
    { action: 'codeblock', label: '{ }', title: 'Code block', command: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive('codeBlock') },
    { divider: true },
    { action: 'link', label: '🔗', title: 'Insert link', command: (e) => {
      const existing = e.getAttributes('link').href || '';
      const href = window.prompt('URL', existing);
      if (href === null) return false;
      if (!href) return e.chain().focus().unsetLink().run();
      return e.chain().focus().setLink({ href }).run();
    }, active: (e) => e.isActive('link') },
    { action: 'image', label: '🖼', title: 'Insert image', command: (e) => {
      const src = window.prompt('Image URL');
      if (!src) return false;
      return e.chain().focus().setImage({ src }).run();
    } },
    { action: 'table', label: '▦', title: 'Insert table', command: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { action: 'undo', label: '↶', title: 'Undo', command: (e) => e.chain().focus().undo().run() },
    { action: 'redo', label: '↷', title: 'Redo', command: (e) => e.chain().focus().redo().run() },
  ];

  function init() {
    const toolbar = document.getElementById('wysiwyg-toolbar');
    if (!toolbar) return;

    toolbar.innerHTML = '';
    BUTTONS.forEach((config) => {
      if (config.divider) {
        const divider = document.createElement('span');
        divider.className = 'wysiwyg-toolbar-divider';
        toolbar.appendChild(divider);
        return;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wysiwyg-toolbar-btn';
      button.dataset.action = config.action;
      button.title = config.title;
      button.textContent = config.label;
      button.addEventListener('click', () => {
        const editor = window.wysiwyg?.getEditor?.();
        if (!editor) return;
        config.command(editor);
        refresh();
      });
      toolbar.appendChild(button);
    });
  }

  function refresh() {
    const editor = window.wysiwyg?.getEditor?.();
    if (!editor) return;

    BUTTONS.forEach((config) => {
      if (config.divider) return;
      const button = document.querySelector(`.wysiwyg-toolbar-btn[data-action="${config.action}"]`);
      if (!button) return;
      button.classList.toggle('active', Boolean(config.active?.(editor)));
    });
  }

  window.wysiwygToolbar = { init, refresh };
})();
