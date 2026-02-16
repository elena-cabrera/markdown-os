(() => {
  const COLLAPSE_KEY = "markdown-os-file-tree-collapsed";

  const fileTreeState = {
    mode: "file",
    currentFile: null,
    collapsedFolders: new Set(),
    fileTreeData: null,
    searchQuery: "",
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
        if (child.path === fileTreeState.currentFile) {
          fileButton.classList.add("active");
        }
        fileButton.addEventListener("click", async () => {
          if (child.path === fileTreeState.currentFile) {
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
    document
      .getElementById("file-tree-toggle")
      ?.addEventListener("click", toggleFileTreeCollapse);
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
