(() => {
  const AUTOSAVE_DELAY_MS = 1000;
  const tabsState = { tabs: new Map(), order: [], active: null, enabled: false };

  function isEnabled() { return tabsState.enabled; }
  function getActiveTabPath() { return tabsState.active; }

  function setSaveStatus(message, variant = 'neutral') {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('is-saving', 'is-saved', 'is-error');
    if (variant === 'saving') el.classList.add('is-saving');
    if (variant === 'saved') el.classList.add('is-saved');
    if (variant === 'error') el.classList.add('is-error');
  }

  function setEmptyState(show) {
    document.getElementById('empty-state')?.classList.toggle('hidden', !show);
    document.getElementById('wysiwyg-container')?.classList.toggle('hidden', show);
  }

  function renderBar() {
    const bar = document.getElementById('file-tabs-bar');
    if (!bar) return;
    if (!tabsState.enabled) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
    bar.classList.remove('hidden');
    bar.innerHTML = '';

    tabsState.order.forEach((path) => {
      const tab = tabsState.tabs.get(path);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `file-tab ${path === tabsState.active ? 'active' : ''}`;
      btn.textContent = `${path.split('/').pop()}${tab.isDirty ? ' •' : ''}`;
      btn.title = path;
      btn.addEventListener('click', () => switchTab(path));
      bar.appendChild(btn);
    });
  }

  function ensureTab(path) {
    if (tabsState.tabs.has(path)) return tabsState.tabs.get(path);
    const data = { content: '', lastSaved: '', isDirty: false, saveTimeout: null, isLoaded: false };
    tabsState.tabs.set(path, data);
    tabsState.order.push(path);
    return data;
  }

  async function loadTab(path) {
    const tab = ensureTab(path);
    if (tab.isLoaded) return true;
    const response = await fetch(`/api/content?file=${encodeURIComponent(path)}`);
    if (!response.ok) return false;
    const payload = await response.json();
    tab.content = payload.content || '';
    tab.lastSaved = tab.content;
    tab.isDirty = false;
    tab.isLoaded = true;
    return true;
  }

  async function switchTab(path) {
    const current = tabsState.active ? tabsState.tabs.get(tabsState.active) : null;
    if (current) {
      current.content = window.wysiwyg.getMarkdown();
      current.isDirty = current.content !== current.lastSaved;
    }

    const ok = await loadTab(path);
    if (!ok) return false;
    tabsState.active = path;
    const tab = tabsState.tabs.get(path);
    window.wysiwyg.setMarkdown(tab.content);
    document.getElementById('current-file-text').textContent = path;
    document.getElementById('current-file-path')?.classList.remove('hidden');
    setEmptyState(false);
    setSaveStatus(tab.isDirty ? 'Unsaved changes' : 'Loaded', tab.isDirty ? 'neutral' : 'saved');
    renderBar();
    window.fileTree?.setCurrentFile?.(path);
    return true;
  }

  async function openTab(path) {
    ensureTab(path);
    return switchTab(path);
  }

  async function reloadTab(path) {
    if (!path) return false;
    const tab = ensureTab(path);
    tab.isLoaded = false;
    return switchTab(path);
  }

  function updateActiveTabContent(content) {
    if (!tabsState.active) return;
    const tab = tabsState.tabs.get(tabsState.active);
    tab.content = content;
    tab.isDirty = tab.content !== tab.lastSaved;
    setSaveStatus(tab.isDirty ? 'Unsaved changes' : 'Saved', tab.isDirty ? 'neutral' : 'saved');
    renderBar();

    if (tab.saveTimeout) clearTimeout(tab.saveTimeout);
    tab.saveTimeout = window.setTimeout(() => saveTabContent(tabsState.active), AUTOSAVE_DELAY_MS);
  }

  async function saveTabContent(path) {
    const tab = tabsState.tabs.get(path);
    if (!tab) return false;
    const content = path === tabsState.active ? window.wysiwyg.getMarkdown() : tab.content;
    const response = await fetch('/api/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: path, content }),
    });
    if (!response.ok) {
      setSaveStatus('Save failed', 'error');
      return false;
    }
    tab.content = content;
    tab.lastSaved = content;
    tab.isDirty = false;
    setSaveStatus('Saved', 'saved');
    renderBar();
    return true;
  }

  function init(mode) {
    tabsState.enabled = mode === 'folder';
    renderBar();
  }

  window.fileTabs = {
    init,
    isEnabled,
    getActiveTabPath,
    openTab,
    reloadTab,
    saveTabContent,
    updateActiveTabContent,
    setEmptyState,
  };
})();
