(() => {
  const AUTOSAVE_DELAY_MS = 1000;
  const state = {
    mode: 'file',
    currentFilePath: null,
    lastSavedContent: '',
    saveTimeout: null,
    isSaving: false,
  };

  function setSaveStatus(message, variant = 'neutral') {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('is-saving', 'is-saved', 'is-error');
    if (variant === 'saving') el.classList.add('is-saving');
    if (variant === 'saved') el.classList.add('is-saved');
    if (variant === 'error') el.classList.add('is-error');
  }

  function setPageTitle(metadata) {
    const name = metadata?.relative_path || metadata?.path?.split(/[\\/]/).pop() || '';
    const filePath = document.getElementById('current-file-path');
    const fileText = document.getElementById('current-file-text');
    if (filePath && fileText) {
      fileText.textContent = name;
      filePath.classList.toggle('hidden', !name);
    }
    document.title = name || 'Markdown-OS';
  }

  async function detectMode() {
    try {
      const response = await fetch('/api/mode');
      const payload = await response.json();
      return payload.mode || 'file';
    } catch {
      return 'file';
    }
  }

  function buildContentUrl(filePath = null) {
    if (state.mode === 'file') return '/api/content';
    const target = filePath || state.currentFilePath;
    if (!target) return null;
    return `/api/content?file=${encodeURIComponent(target)}`;
  }

  async function loadContent(filePath = null) {
    if (state.mode === 'folder' && window.fileTabs?.isEnabled()) {
      return window.fileTabs.reloadTab(filePath || window.fileTabs.getActiveTabPath());
    }

    const url = buildContentUrl(filePath);
    if (!url) {
      window.wysiwyg?.setMarkdown('');
      state.lastSavedContent = '';
      setSaveStatus('Select a file');
      return false;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('load failed');
      const payload = await response.json();
      const content = payload.content || '';
      window.wysiwyg?.setMarkdown(content);
      state.lastSavedContent = content;
      setPageTitle(payload.metadata);

      if (state.mode === 'folder') {
        const path = payload.metadata?.relative_path || filePath || null;
        state.currentFilePath = path;
        window.fileTree?.setCurrentFile?.(path);
      }

      setSaveStatus('Loaded', 'saved');
      window.generateTOC?.();
      return true;
    } catch (error) {
      console.error(error);
      setSaveStatus('Load failed', 'error');
      return false;
    }
  }

  async function saveContent() {
    if (state.mode === 'folder' && window.fileTabs?.isEnabled()) {
      return window.fileTabs.saveTabContent(window.fileTabs.getActiveTabPath());
    }

    if (state.isSaving) return false;
    if (state.mode === 'folder' && !state.currentFilePath) {
      setSaveStatus('Select a file', 'error');
      return false;
    }

    state.isSaving = true;
    setSaveStatus('Saving...', 'saving');
    const content = window.wysiwyg?.getMarkdown?.() || '';

    try {
      const payload = { content };
      if (state.mode === 'folder') payload.file = state.currentFilePath;
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('save failed');
      const savePayload = await response.json();
      state.lastSavedContent = content;
      if (state.mode === 'folder') {
        state.currentFilePath = savePayload.metadata?.relative_path || state.currentFilePath;
      }
      setSaveStatus('Saved', 'saved');
      return true;
    } catch (error) {
      console.error(error);
      setSaveStatus('Save failed', 'error');
      return false;
    } finally {
      state.isSaving = false;
    }
  }

  function onEditorInput(content) {
    if (state.mode === 'folder' && window.fileTabs?.isEnabled()) {
      window.fileTabs.updateActiveTabContent(content);
      return;
    }

    if (content !== state.lastSavedContent) {
      setSaveStatus('Unsaved changes');
      if (state.saveTimeout) clearTimeout(state.saveTimeout);
      state.saveTimeout = window.setTimeout(saveContent, AUTOSAVE_DELAY_MS);
    }
  }

  async function switchFile(filePath) {
    if (state.mode !== 'folder') {
      state.mode = await detectMode();
      if (state.mode !== 'folder') return false;
    }
    if (!window.fileTabs.isEnabled()) window.fileTabs.init('folder');
    return window.fileTabs.openTab(filePath);
  }

  function bindImageUploads() {
    const host = document.getElementById('wysiwyg-editor');
    if (!host) return;

    async function upload(file) {
      const formData = new FormData();
      formData.append('file', file, file.name || 'paste.png');
      setSaveStatus('Uploading image...', 'saving');
      try {
        const response = await fetch('/api/images', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('upload failed');
        const payload = await response.json();
        const editor = window.wysiwyg.getEditor();
        editor.chain().focus().setImage({ src: payload.path, alt: file.name || 'image' }).run();
        setSaveStatus('Image uploaded', 'saved');
      } catch (error) {
        console.error(error);
        setSaveStatus('Image upload failed', 'error');
      }
    }

    host.addEventListener('paste', (event) => {
      const file = Array.from(event.clipboardData?.files || []).find((item) => item.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault();
      upload(file);
    });

    host.addEventListener('dragover', (event) => {
      if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
      event.preventDefault();
    });

    host.addEventListener('drop', (event) => {
      const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith('image/'));
      if (!files.length) return;
      event.preventDefault();
      files.forEach(upload);
    });
  }

  window.loadContent = loadContent;
  window.saveContent = saveContent;
  window.switchFile = switchFile;

  document.addEventListener('DOMContentLoaded', async () => {
    state.mode = await detectMode();
    window.wysiwygToolbar?.init?.();
    window.wysiwyg?.init({ content: '', onUpdate: onEditorInput });
    bindImageUploads();

    if (state.mode === 'file') {
      await loadContent();
    } else {
      window.fileTabs?.init(state.mode);
      setSaveStatus('Select a file');
      window.fileTabs?.setEmptyState?.(true);
    }

    window.addEventListener('markdown-os:file-changed', async (event) => {
      const content = event.detail?.content;
      if (typeof content !== 'string') return;
      if (content === window.wysiwyg.getMarkdown()) return;
      const hasUnsaved = window.wysiwyg.getMarkdown() !== state.lastSavedContent;
      if (hasUnsaved && !window.confirm('File changed on disk. Reload and discard local changes?')) return;
      window.wysiwyg.setMarkdown(content);
      state.lastSavedContent = content;
      setSaveStatus('Reloaded from disk', 'saved');
    });
  });
})();
