(() => {
  const COLLAPSE_KEY = "markdown-os-toc-collapsed";

  const tocState = {
    headings: [],
    scrollBound: false,
  };

  function collapseTOC() {
    const toggle = document.getElementById("toc-toggle");
    const collapsible = document.getElementById("toc-collapsible");
    const container = document.getElementById("toc-container");
    if (!toggle || !collapsible || !container) {
      return;
    }

    toggle.setAttribute("aria-expanded", "false");
    collapsible.classList.add("collapsed");
    container.classList.add("collapsed");
  }

  function expandTOC() {
    const toggle = document.getElementById("toc-toggle");
    const collapsible = document.getElementById("toc-collapsible");
    const container = document.getElementById("toc-container");
    if (!toggle || !collapsible || !container) {
      return;
    }

    toggle.setAttribute("aria-expanded", "true");
    collapsible.classList.remove("collapsed");
    container.classList.remove("collapsed");
  }

  function restoreTOCCollapseState() {
    let collapsed = false;

    try {
      collapsed = window.localStorage.getItem(COLLAPSE_KEY) === "true";
    } catch (_error) {
      collapsed = false;
    }

    if (collapsed) {
      collapseTOC();
    } else {
      expandTOC();
    }
  }

  function toggleTOCCollapse() {
    const toggle = document.getElementById("toc-toggle");
    if (!toggle) {
      return;
    }

    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    if (isExpanded) {
      collapseTOC();
    } else {
      expandTOC();
    }

    try {
      window.localStorage.setItem(COLLAPSE_KEY, String(isExpanded));
    } catch (_error) {
      // Ignore storage errors.
    }
  }

  function getHeadingLevel(heading) {
    return Number(heading.tagName?.replace("H", "")) || 1;
  }

  function setActiveTOCLink(activeHeadingId) {
    document.querySelectorAll("#toc a[data-target-id], #focus-toc a[data-target-id]").forEach((link) => {
      if (link.dataset.targetId === activeHeadingId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  function createTOCTree(headings) {
    const rootList = document.createElement("ul");
    rootList.className = "root-list";

    const listStack = [rootList];
    let currentLevel = 1;
    let lastItem = null;

    headings.forEach((heading) => {
      const level = getHeadingLevel(heading);
      const text = heading.textContent || heading.id || "section";

      while (level > currentLevel && lastItem) {
        const nestedList = document.createElement("ul");
        lastItem.appendChild(nestedList);
        listStack.push(nestedList);
        currentLevel += 1;
      }

      while (level < currentLevel && listStack.length > 1) {
        listStack.pop();
        currentLevel -= 1;
      }

      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${heading.id}`;
      link.dataset.targetId = heading.id;
      link.textContent = text;

      item.appendChild(link);
      listStack[listStack.length - 1].appendChild(item);
      lastItem = item;
      currentLevel = level;
    });

    return rootList;
  }

  function bindTOCLinkHandlers() {
    document.querySelectorAll("#toc a[data-target-id], #focus-toc a[data-target-id]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const targetId = link.dataset.targetId;
        if (!targetId) {
          return;
        }

        window.wysiwyg?.scrollHeadingIntoView?.(targetId);
      });
    });
  }

  const HEADING_ACTIVATION_OFFSET_PX = 100;

  function findActiveHeadingIndex() {
    const container = document.getElementById("editor-container");
    if (!container || tocState.headings.length === 0) {
      return 0;
    }

    const scrollPosition = container.scrollTop + HEADING_ACTIVATION_OFFSET_PX;
    let activeIndex = 0;
    tocState.headings.forEach((heading, index) => {
      if (heading.offsetTop <= scrollPosition) {
        activeIndex = index;
      }
    });

    return activeIndex;
  }

  function updateActiveTOCItem() {
    if (tocState.headings.length === 0) {
      return;
    }

    const activeIndex = findActiveHeadingIndex();
    const activeHeading = tocState.headings[Math.min(activeIndex, tocState.headings.length - 1)];
    if (!activeHeading) {
      return;
    }

    setActiveTOCLink(activeHeading.id);
  }

  function ensureScrollBinding() {
    if (tocState.scrollBound) {
      return;
    }

    const container = document.getElementById("editor-container");
    if (!container) {
      return;
    }

    container.addEventListener("scroll", updateActiveTOCItem, {
      passive: true,
    });
    tocState.scrollBound = true;
  }

  function generateTOC() {
    const toc = document.getElementById("toc");
    const focusToc = document.getElementById("focus-toc");
    if (!toc || !focusToc) {
      return;
    }

    const headings = window.wysiwyg?.getHeadingElements?.() || [];
    if (headings.length === 0) {
      toc.innerHTML = '<p class="tree-empty-state">No headings</p>';
      focusToc.innerHTML = "";
      tocState.headings = [];
      return;
    }

    tocState.headings = headings;
    toc.innerHTML = "";
    focusToc.innerHTML = "";
    toc.appendChild(createTOCTree(headings));
    focusToc.appendChild(createTOCTree(headings));
    bindTOCLinkHandlers();
    ensureScrollBinding();
    updateActiveTOCItem();
  }

  function initTOC() {
    document.getElementById("toc-toggle")?.addEventListener("click", toggleTOCCollapse);
    restoreTOCCollapseState();
  }

  window.generateTOC = generateTOC;
  window.findActiveHeadingIndex = findActiveHeadingIndex;
  window.updateActiveTOCItem = updateActiveTOCItem;

  document.addEventListener("DOMContentLoaded", initTOC);
})();
