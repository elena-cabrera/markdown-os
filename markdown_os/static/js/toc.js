(() => {
  const tocState = {
    headings: [],
    scrollBound: false,
  };

  function getHeadingLevel(heading) {
    return Number(heading.tagName?.replace("H", "")) || 1;
  }

  function setActiveTOCLink(activeHeadingId) {
    document.querySelectorAll("#toc a[data-target-id]").forEach((link) => {
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
    document.querySelectorAll("#toc a[data-target-id]").forEach((link) => {
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

  function findActiveHeadingIndex() {
    const container = document.getElementById("editor-container");
    if (!container || tocState.headings.length === 0) {
      return 0;
    }

    const scrollPosition = container.scrollTop + 100;
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
    if (!toc) {
      return;
    }

    const headings = window.wysiwyg?.getHeadingElements?.() || [];
    if (headings.length === 0) {
      toc.innerHTML = '<p class="tree-empty-state">No headings</p>';
      tocState.headings = [];
      return;
    }

    tocState.headings = headings;
    toc.innerHTML = "";
    toc.appendChild(createTOCTree(headings));
    bindTOCLinkHandlers();
    ensureScrollBinding();
    updateActiveTOCItem();
  }

  window.generateTOC = generateTOC;
  window.findActiveHeadingIndex = findActiveHeadingIndex;
  window.updateActiveTOCItem = updateActiveTOCItem;
})();
