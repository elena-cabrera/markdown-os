(() => {
  const tocState = {
    headings: [],
    boundScroll: false,
  };

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

      const nextId = duplicateCount === 0 ? rawId : `${rawId}-${duplicateCount + 1}`;
      heading.id = nextId;
    });
  }

  function createTOCTree(headings) {
    const rootList = document.createElement("ul");
    rootList.className = "root-list";

    const listStack = [rootList];
    let currentLevel = 1;
    let lastItem = null;

    headings.forEach((heading) => {
      const level = Number(heading.tagName.replace("H", "")) || 1;

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
      link.textContent = heading.textContent || heading.id;
      item.appendChild(link);
      listStack[listStack.length - 1].appendChild(item);
      lastItem = item;
      currentLevel = level;
    });

    return rootList;
  }

  function bindTOCLinkHandlers() {
    const links = document.querySelectorAll("#toc a[data-target-id]");
    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const targetId = link.dataset.targetId;
        if (!targetId) {
          return;
        }

        const heading = document.getElementById(targetId);
        if (!heading) {
          return;
        }

        heading.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  }

  function updateActiveTOCItem() {
    const previewContainer = document.getElementById("preview-container");
    if (!previewContainer || tocState.headings.length === 0) {
      return;
    }

    let activeHeadingId = tocState.headings[0].id;
    const scrollPosition = previewContainer.scrollTop + 100;
    tocState.headings.forEach((heading) => {
      if (heading.offsetTop <= scrollPosition) {
        activeHeadingId = heading.id;
      }
    });

    document.querySelectorAll("#toc a[data-target-id]").forEach((link) => {
      if (link.dataset.targetId === activeHeadingId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  function ensureScrollBinding() {
    if (tocState.boundScroll) {
      return;
    }

    const previewContainer = document.getElementById("preview-container");
    if (!previewContainer) {
      return;
    }

    previewContainer.addEventListener("scroll", updateActiveTOCItem, {
      passive: true,
    });
    tocState.boundScroll = true;
  }

  function generateTOC() {
    const preview = document.getElementById("markdown-preview");
    const toc = document.getElementById("toc");
    if (!preview || !toc) {
      return;
    }

    const headings = Array.from(
      preview.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    );
    if (headings.length === 0) {
      toc.innerHTML = "<p>No headings</p>";
      tocState.headings = [];
      return;
    }

    addHeadingIds(headings);
    tocState.headings = headings;

    const tocTree = createTOCTree(headings);
    toc.innerHTML = "";
    toc.appendChild(tocTree);
    bindTOCLinkHandlers();
    ensureScrollBinding();
    updateActiveTOCItem();
  }

  window.generateTOC = generateTOC;
})();
