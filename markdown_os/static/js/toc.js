(() => {
  const tocState = {
    headings: [],
    isScrollBound: false,
  };

  function headingContainer() {
    return document.querySelector("#wysiwyg-editor .ProseMirror");
  }

  function scrollContainer() {
    return document.getElementById("wysiwyg-container");
  }

  function slugifyHeading(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function addHeadingIds(headings) {
    const usedIds = new Map();
    headings.forEach((heading) => {
      const rawId = heading.id || slugifyHeading(heading.textContent || "section");
      const duplicateCount = usedIds.get(rawId) || 0;
      usedIds.set(rawId, duplicateCount + 1);
      heading.id = duplicateCount === 0 ? rawId : `${rawId}-${duplicateCount + 1}`;
    });
  }

  function headingLevel(heading) {
    const level = Number(heading.tagName.replace("H", ""));
    return Number.isNaN(level) ? 1 : level;
  }

  function setActiveTOCLink(activeHeadingId) {
    document.querySelectorAll("#toc a[data-target-id]").forEach((link) => {
      link.classList.toggle("active", link.dataset.targetId === activeHeadingId);
    });
  }

  function createTOCTree(headings) {
    const rootList = document.createElement("ul");
    rootList.className = "root-list";

    const listStack = [rootList];
    let currentLevel = 1;
    let lastItem = null;

    headings.forEach((heading) => {
      const level = headingLevel(heading);
      const title = heading.textContent || "section";

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
      link.textContent = title;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        heading.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        setActiveTOCLink(heading.id);
      });

      item.appendChild(link);
      listStack[listStack.length - 1].appendChild(item);
      lastItem = item;
      currentLevel = level;
    });

    return rootList;
  }

  function updateActiveTOCItem() {
    const container = scrollContainer();
    if (!container || tocState.headings.length === 0) {
      return;
    }

    const scrollPosition = container.scrollTop + 120;
    let activeHeadingId = tocState.headings[0].id;
    tocState.headings.forEach((heading) => {
      if (heading.offsetTop <= scrollPosition) {
        activeHeadingId = heading.id;
      }
    });

    setActiveTOCLink(activeHeadingId);
  }

  function bindScrollTracking() {
    if (tocState.isScrollBound) {
      return;
    }

    const container = scrollContainer();
    if (!container) {
      return;
    }

    container.addEventListener("scroll", updateActiveTOCItem, { passive: true });
    tocState.isScrollBound = true;
  }

  function generateTOC() {
    const toc = document.getElementById("toc");
    const contentRoot = headingContainer();
    if (!toc || !contentRoot) {
      return;
    }

    const headings = Array.from(contentRoot.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    if (headings.length === 0) {
      toc.innerHTML = '<p class="tree-empty-state">No headings</p>';
      tocState.headings = [];
      return;
    }

    addHeadingIds(headings);
    tocState.headings = headings;

    toc.innerHTML = "";
    toc.appendChild(createTOCTree(headings));
    bindScrollTracking();
    updateActiveTOCItem();
  }

  window.generateTOC = generateTOC;
  window.updateActiveTOCItem = updateActiveTOCItem;
})();
