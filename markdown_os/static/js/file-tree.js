(() => {
  const COLLAPSE_KEY = "markdown-os-file-tree-collapsed";

  const fileTreeState = {
    mode: "file",
    currentFile: null,
    collapsedFolders: new Set(),
    fileTreeData: null,
    searchQuery: "",
    activeContextMenu: null,
    dismissBound: false,
  };

  function setFolderModeUI() {
    document.getElementById("file-tree-container")?.classList.remove("hidden");
    document.getElementById("current-file-path")?.classList.remove("hidden");
    restoreFileTreeCollapseState();
  }

  function collapseFileTree() {
    const toggle = document.getElementById("file-tree-toggle");
    const collapsible = document.getElementById("file-tree-collapsible");
    const container = document.getElementById("file-tree-container");
    if (!toggle || !collapsible || !container) {
      return;
    }

    toggle.setAttribute("aria-expanded", "false");
    collapsible.classList.add("collapsed");
    container.classList.add("collapsed");
  }

  function expandFileTree() {
    const toggle = document.getElementById("file-tree-toggle");
    const collapsible = document.getElementById("file-tree-collapsible");
    const container = document.getElementById("file-tree-container");
    if (!toggle || !collapsible || !container) {
      return;
    }

    toggle.setAttribute("aria-expanded", "true");
    collapsible.classList.remove("collapsed");
    container.classList.remove("collapsed");
  }

  function restoreFileTreeCollapseState() {
    let collapsed = false;

    try {
      collapsed = window.localStorage.getItem(COLLAPSE_KEY) === "true";
    } catch (_error) {
      collapsed = false;
    }

    if (collapsed) {
      collapseFileTree();
    } else {
      expandFileTree();
    }
  }

  function toggleFileTreeCollapse() {
    const toggle = document.getElementById("file-tree-toggle");
    if (!toggle) {
      return;
    }

    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    if (isExpanded) {
      collapseFileTree();
    } else {
      expandFileTree();
    }

    try {
      window.localStorage.setItem(COLLAPSE_KEY, String(isExpanded));
    } catch (_error) {
      // Ignore storage errors.
    }
  }

  function updateCurrentFileLabel() {
    const currentFileText = document.getElementById("current-file-text");
    if (!currentFileText) {
      return;
    }
    currentFileText.textContent = fileTreeState.currentFile || "";
  }

  function updateUrl(filePath) {
    if (fileTreeState.mode !== "folder") {
      return;
    }

    const url = new URL(window.location.href);
    if (filePath) {
      url.searchParams.set("file", filePath);
    } else {
      url.searchParams.delete("file");
    }
    window.history.replaceState({}, "", url);
  }

  function updateActiveFileStyles() {
    document.querySelectorAll(".tree-file-link[data-path]").forEach((node) => {
      if (node.getAttribute("data-path") === fileTreeState.currentFile) {
        node.classList.add("active");
      } else {
        node.classList.remove("active");
      }
    });
  }

  function setCurrentFile(filePath) {
    fileTreeState.currentFile = filePath;
    updateCurrentFileLabel();
    updateActiveFileStyles();
    updateUrl(filePath);
  }

  async function getMode() {
    try {
      const response = await fetch("/api/mode");
      if (!response.ok) {
        return "file";
      }
      const payload = await response.json();
      return payload.mode || "file";
    } catch (error) {
      console.error("Failed to detect app mode.", error);
      return "file";
    }
  }

  function filterTreeNode(node, query) {
    if (!query) {
      return node;
    }

    if (node.type === "file") {
      return node.name.toLowerCase().includes(query) ? { ...node } : null;
    }

    const nextChildren = [];
    for (const child of node.children || []) {
      const filteredChild = filterTreeNode(child, query);
      if (filteredChild) {
        nextChildren.push(filteredChild);
      }
    }

    if (node.path === "") {
      return { ...node, children: nextChildren };
    }

    if (nextChildren.length === 0 && !node.name.toLowerCase().includes(query)) {
      return null;
    }

    return { ...node, children: nextChildren };
  }

  async function apiJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`${url} failed (${response.status})`);
    }

    return response.json();
  }

  function basename(filePath) {
    const parts = (filePath || "").split("/");
    return parts[parts.length - 1] || filePath;
  }

  function hideContextMenu() {
    if (fileTreeState.activeContextMenu) {
      fileTreeState.activeContextMenu.remove();
      fileTreeState.activeContextMenu = null;
    }
  }

  function positionContextMenu(menu, x, y) {
    const margin = 8;
    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - margin;
    const maxY = window.innerHeight - rect.height - margin;
    menu.style.left = `${Math.max(margin, Math.min(x, maxX))}px`;
    menu.style.top = `${Math.max(margin, Math.min(y, maxY))}px`;
  }

  function createContextMenuItem(label, iconSvg, onClick) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "context-menu-item";
    item.innerHTML = `${iconSvg}<span>${label}</span>`;
    item.addEventListener("click", async () => {
      hideContextMenu();
      await onClick();
    });
    return item;
  }

  async function handleNewFile(parentPath = "") {
    const name = await window.markdownDialogs?.prompt?.({
      title: "New file",
      message: "Enter filename (e.g. notes.md):",
      label: "Filename",
      placeholder: "notes.md",
      confirmText: "Create",
    });

    if (!name) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const targetPath = parentPath ? `${parentPath}/${trimmedName}` : trimmedName;

    try {
      const payload = await apiJson("/api/files/create", {
        method: "POST",
        body: JSON.stringify({ path: targetPath }),
      });
      await loadFileTree();
      const createdPath = payload.path;
      if (window.fileTabs?.isEnabled?.()) {
        await window.fileTabs.openTab(createdPath);
      } else if (typeof window.switchFile === "function") {
        await window.switchFile(createdPath);
      }
    } catch (error) {
      console.error("Failed to create file.", error);
    }
  }

  async function handleRename(path, _type) {
    const nextName = await window.markdownDialogs?.prompt?.({
      title: "Rename",
      message: "Enter a new name:",
      label: "Name",
      value: basename(path),
      confirmText: "Rename",
    });

    if (!nextName) {
      return;
    }

    try {
      const payload = await apiJson("/api/files/rename", {
        method: "POST",
        body: JSON.stringify({ path, new_name: nextName.trim() }),
      });
      await loadFileTree();
      window.fileTabs?.renameTab?.(path, payload.path);
      if (fileTreeState.currentFile === path) {
        setCurrentFile(payload.path);
      }
    } catch (error) {
      console.error("Failed to rename path.", error);
    }
  }

  async function handleDelete(path) {
    const confirmed = await window.markdownDialogs?.confirm?.({
      title: "Delete file",
      message: `Delete "${basename(path)}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      confirmVariant: "danger",
    });

    if (!confirmed) {
      return;
    }

    try {
      await apiJson("/api/files/delete", {
        method: "DELETE",
        body: JSON.stringify({ path }),
      });
      await loadFileTree();
      await window.fileTabs?.closeTab?.(path, { skipDirtyCheck: true });
      if (fileTreeState.currentFile === path) {
        setCurrentFile(null);
      }
    } catch (error) {
      console.error("Failed to delete file.", error);
    }
  }

  function showContextMenu(event, path, type) {
    event.preventDefault();
    hideContextMenu();

    const renameSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75z" fill="currentColor"/></svg>';
    const deleteSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" fill="currentColor"/></svg>';

    const menu = document.createElement("div");
    menu.className = "context-menu";

    menu.appendChild(createContextMenuItem("Rename", renameSvg, () => handleRename(path, type)));

    if (type === "file") {
      menu.appendChild(document.createElement("div")).className = "context-menu-separator";
      menu.appendChild(createContextMenuItem("Delete", deleteSvg, () => handleDelete(path)));
    }

    document.body.appendChild(menu);
    positionContextMenu(menu, event.clientX, event.clientY);
    fileTreeState.activeContextMenu = menu;
  }

  function bindContextMenuDismiss() {
    if (fileTreeState.dismissBound) {
      return;
    }

    document.addEventListener("click", () => {
      hideContextMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideContextMenu();
      }
    });

    document.addEventListener(
      "scroll",
      () => {
        hideContextMenu();
      },
      true,
    );

    fileTreeState.dismissBound = true;
  }

  function renderTreeNode(node, parentElement) {
    if (!node || !Array.isArray(node.children)) {
      return;
    }

    const list = document.createElement("ul");
    list.className = parentElement.id === "file-tree" ? "tree-root" : "tree-children";
    parentElement.appendChild(list);

    for (const child of node.children) {
      const item = document.createElement("li");
      if (child.type === "folder") {
        item.className = "tree-folder";

        const headerButton = document.createElement("button");
        headerButton.type = "button";
        headerButton.className = "tree-folder-header";
        headerButton.setAttribute("data-path", child.path);
        headerButton.addEventListener("contextmenu", (event) =>
          showContextMenu(event, child.path, child.type),
        );

        const isCollapsed =
          !fileTreeState.searchQuery && fileTreeState.collapsedFolders.has(child.path);
        headerButton.setAttribute("aria-expanded", String(!isCollapsed));

        const icon = document.createElement("span");
        icon.className = "folder-icon";
        icon.textContent = isCollapsed ? "▶" : "▼";

        const name = document.createElement("span");
        name.className = "folder-name";
        name.textContent = child.name;

        headerButton.appendChild(icon);
        headerButton.appendChild(name);
        headerButton.addEventListener("click", () => {
          if (fileTreeState.searchQuery) {
            return;
          }
          if (fileTreeState.collapsedFolders.has(child.path)) {
            fileTreeState.collapsedFolders.delete(child.path);
          } else {
            fileTreeState.collapsedFolders.add(child.path);
          }
          renderTree();
        });

        item.appendChild(headerButton);

        if (!isCollapsed && child.children && child.children.length > 0) {
          renderTreeNode(child, item);
        }
      } else {
        item.className = "tree-file";

        const fileButton = document.createElement("button");
        fileButton.type = "button";
        fileButton.className = "tree-file-link";
        fileButton.textContent = child.name;
        fileButton.setAttribute("data-path", child.path);
        fileButton.addEventListener("contextmenu", (event) =>
          showContextMenu(event, child.path, child.type),
        );
        if (child.path === fileTreeState.currentFile) {
          fileButton.classList.add("active");
        }
        fileButton.addEventListener("click", async () => {
          if (child.path === fileTreeState.currentFile) {
            return;
          }
          if (window.fileTabs?.isEnabled?.()) {
            await window.fileTabs.openTab(child.path);
            return;
          }
          if (typeof window.switchFile !== "function") {
            return;
          }
          await window.switchFile(child.path);
        });

        item.appendChild(fileButton);
      }

      list.appendChild(item);
    }
  }

  function renderTree() {
    const treeRoot = document.getElementById("file-tree");
    if (!treeRoot) {
      return;
    }

    treeRoot.innerHTML = "";
    const visibleTree = filterTreeNode(
      fileTreeState.fileTreeData,
      fileTreeState.searchQuery.toLowerCase(),
    );
    if (!visibleTree || !Array.isArray(visibleTree.children) || visibleTree.children.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "tree-empty-state";
      emptyState.textContent = "No matching files";
      treeRoot.appendChild(emptyState);
      return;
    }

    renderTreeNode(visibleTree, treeRoot);
  }

  async function loadFileTree() {
    try {
      const response = await fetch("/api/file-tree");
      if (!response.ok) {
        throw new Error(`Failed to load file tree (${response.status})`);
      }

      const payload = await response.json();
      fileTreeState.fileTreeData = payload;
      renderTree();
    } catch (error) {
      console.error("Failed to load file tree.", error);
    }
  }

  function bindSearch() {
    const searchInput = document.getElementById("file-tree-search");
    if (!searchInput) {
      return;
    }

    searchInput.addEventListener("input", () => {
      fileTreeState.searchQuery = searchInput.value.trim();
      renderTree();
    });
  }

  function initFileTree() {
    bindSearch();
    bindContextMenuDismiss();
    document
      .getElementById("file-tree-toggle")
      ?.addEventListener("click", toggleFileTreeCollapse);

    document.getElementById("file-tree-new-file")?.addEventListener("click", async () => {
      await handleNewFile();
    });
  }

  window.fileTree = {
    initFileTree,
    loadFileTree,
    setCurrentFile,
  };

  document.addEventListener("DOMContentLoaded", async () => {
    fileTreeState.mode = await getMode();
    if (fileTreeState.mode !== "folder") {
      return;
    }

    setFolderModeUI();
    initFileTree();
    await loadFileTree();

    const initialFile = new URLSearchParams(window.location.search).get("file");
    if (initialFile && typeof window.switchFile === "function") {
      await window.switchFile(initialFile);
    }
  });
})();
