(() => {
  const state = {
    editor: null,
    onUpdate: null,
  };

  function createExtensions() {
    const {
      StarterKit,
      Markdown,
      Link,
      Image,
      TaskList,
      TaskItem,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      Placeholder,
    } = window.TipTapBundle;

    return [
      StarterKit.configure({
        codeBlock: true,
      }),
      Markdown.configure({
        transformPastedText: true,
      }),
      Link.configure({
        autolink: true,
        openOnClick: true,
      }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Write markdown…' }),
    ];
  }

  function initWysiwyg({ content = '', onUpdate }) {
    const host = document.getElementById('wysiwyg-editor');
    if (!host || !window.TipTapBundle) {
      return null;
    }

    const { Editor } = window.TipTapBundle;
    state.onUpdate = onUpdate;

    state.editor = new Editor({
      element: host,
      content,
      editorProps: {
        attributes: {
          class: 'markdown-content',
        },
      },
      extensions: createExtensions(),
      onUpdate: ({ editor }) => {
        state.onUpdate?.(editor.getMarkdown());
        window.generateTOC?.();
        window.wysiwygToolbar?.refresh?.();
      },
      onSelectionUpdate: () => {
        window.wysiwygToolbar?.refresh?.();
      },
    });

    return state.editor;
  }

  function getEditor() {
    return state.editor;
  }

  function getMarkdown() {
    return state.editor?.getMarkdown() || '';
  }

  function setMarkdown(content = '') {
    if (!state.editor) {
      return;
    }
    state.editor.commands.setContent(content);
    window.generateTOC?.();
  }

  function focusEditor() {
    state.editor?.commands.focus();
  }

  window.wysiwyg = {
    init: initWysiwyg,
    getEditor,
    getMarkdown,
    setMarkdown,
    focusEditor,
  };
})();
