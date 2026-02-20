(() => {
  const tocState = {
    headingIds: [],
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
      const slug = slugifyHeading(heading.textContent || "section");
      const rawId = heading.id || slug || "section";
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
      const targetHeadingId = heading.id;
      link.href = `#${targetHeadingId}`;
      link.dataset.targetId = targetHeadingId;
      link.textContent = title;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const targetHeading = document.getElementById(targetHeadingId);
        if (!(targetHeading instanceof HTMLElement)) {
          return;
        }

        const container = scrollContainer();
        if (container && container.contains(targetHeading)) {
          container.scrollTo({
            top: Math.max(0, targetHeading.offsetTop - 12),
            behavior: "smooth",
          });
        } else {
          targetHeading.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }

        setActiveTOCLink(targetHeadingId);
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
    if (!container || tocState.headingIds.length === 0) {
      return;
    }

    const headings = tocState.headingIds
      .map((headingId) => document.getElementById(headingId))
      .filter((heading) => heading instanceof HTMLElement);
    if (headings.length === 0) {
      return;
    }

    const scrollPosition = container.scrollTop + 120;
    let activeHeadingId = headings[0].id;
    headings.forEach((heading) => {
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
      tocState.headingIds = [];
      return;
    }

    addHeadingIds(headings);
    tocState.headingIds = headings.map((heading) => heading.id);

    toc.innerHTML = "";
    toc.appendChild(createTOCTree(headings));
    bindScrollTracking();
    updateActiveTOCItem();
  }

  window.generateTOC = generateTOC;
  window.updateActiveTOCItem = updateActiveTOCItem;
})();
