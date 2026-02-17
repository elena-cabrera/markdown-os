(() => {
  const EDIT_SCROLL_ACTIVE_LINE_OFFSET = 5;

  const tocState = {
    headings: [],
    mode: "preview",
    editScrollBound: false,
    previewScrollBound: false,
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

  function getHeadingText(heading) {
    if (typeof heading.text === "string") {
      return heading.text;
    }

    return heading.textContent || heading.id || "section";
  }

  function normalizeHeadingText(text) {
    const source = (text || "").trim();
    if (!source) {
      return "";
    }

    if (window.marked && typeof window.marked.parseInline === "function") {
      const container = document.createElement("div");
      container.innerHTML = window.marked.parseInline(source);
      const plainText = container.textContent?.trim();
      if (plainText) {
        return plainText;
      }
    }

    return source;
  }

  function getHeadingLevel(heading) {
    if (typeof heading.level === "number") {
      return heading.level;
    }

    return Number(heading.tagName?.replace("H", "")) || 1;
  }

  function getLineHeight(element) {
    const styles = window.getComputedStyle(element);
    const parsedLineHeight = Number.parseFloat(styles.lineHeight);
    if (Number.isFinite(parsedLineHeight)) {
      return parsedLineHeight;
    }

    const parsedFontSize = Number.parseFloat(styles.fontSize);
    const fontSize = Number.isFinite(parsedFontSize) ? parsedFontSize : 16;
    return fontSize * 1.6;
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

  function addHeadingIds(headings) {
    const usedIds = new Map();
    headings.forEach((heading) => {
      const rawId = heading.id || slugifyHeading(getHeadingText(heading) || "section");
      const duplicateCount = usedIds.get(rawId) || 0;
      usedIds.set(rawId, duplicateCount + 1);

      const nextId = duplicateCount === 0 ? rawId : `${rawId}-${duplicateCount + 1}`;
      heading.id = nextId;
    });
  }

  function extractHeadingsFromMarkdown(content) {
    if (!content) {
      return [];
    }

    const headings = [];
    const lines = content.split("\n");
    let codeFence = null;

    lines.forEach((line, lineNumber) => {
      const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[1][0];
        const markerLength = fenceMatch[1].length;

        if (!codeFence) {
          codeFence = { marker, markerLength };
          return;
        }

        if (codeFence.marker === marker && markerLength >= codeFence.markerLength) {
          codeFence = null;
          return;
        }
      }

      if (codeFence) {
        return;
      }

      const match = line.match(/^(#{1,6})[ \t]+(.+?)\s*#*\s*$/);
      if (!match) {
        return;
      }

      const text = match[2].trim();
      if (!text) {
        return;
      }

      const normalizedText = normalizeHeadingText(text);
      if (!normalizedText) {
        return;
      }

      headings.push({
        text: normalizedText,
        level: match[1].length,
        lineNumber,
      });
    });

    addHeadingIds(headings);
    return headings;
  }

  function createTOCTree(headings) {
    const rootList = document.createElement("ul");
    rootList.className = "root-list";

    const listStack = [rootList];
    let currentLevel = 1;
    let lastItem = null;

    headings.forEach((heading) => {
      const level = getHeadingLevel(heading);
      const text = getHeadingText(heading);

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

      if (typeof heading.lineNumber === "number") {
        link.dataset.lineNumber = String(heading.lineNumber);
      }

      item.appendChild(link);
      listStack[listStack.length - 1].appendChild(item);
      lastItem = item;
      currentLevel = level;
    });

    return rootList;
  }

  function getCharacterOffsetForLine(text, lineNumber) {
    if (lineNumber <= 0) {
      return 0;
    }

    let offset = 0;
    let currentLine = 0;
    while (currentLine < lineNumber && offset < text.length) {
      const newlineIndex = text.indexOf("\n", offset);
      if (newlineIndex === -1) {
        return text.length;
      }

      offset = newlineIndex + 1;
      currentLine += 1;
    }

    return offset;
  }

  function scrollTextareaToLine(textarea, lineNumber) {
    const lineHeight = getLineHeight(textarea);
    const nextScrollTop = Math.max(0, lineNumber * lineHeight - lineHeight);
    textarea.scrollTop = nextScrollTop;
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

        if (tocState.mode === "edit") {
          const editor = document.getElementById("markdown-editor");
          const lineNumber = Number.parseInt(link.dataset.lineNumber || "", 10);
          if (!editor || Number.isNaN(lineNumber) || lineNumber < 0) {
            return;
          }

          const charOffset = getCharacterOffsetForLine(editor.value, lineNumber);
          editor.focus();
          editor.setSelectionRange(charOffset, charOffset);
          scrollTextareaToLine(editor, lineNumber);
          updateActiveTOCItemForEdit();
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
    if (tocState.mode !== "preview") {
      return;
    }

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

    setActiveTOCLink(activeHeadingId);
  }

  function updateActiveTOCItemForEdit() {
    if (tocState.mode !== "edit") {
      return;
    }

    const editor = document.getElementById("markdown-editor");
    if (!editor || tocState.headings.length === 0) {
      return;
    }

    const lineHeight = getLineHeight(editor);
    const visibleTopLine = Math.max(0, Math.floor(editor.scrollTop / lineHeight));
    let activeHeadingId = tocState.headings[0].id;

    tocState.headings.forEach((heading) => {
      if (heading.lineNumber <= visibleTopLine + EDIT_SCROLL_ACTIVE_LINE_OFFSET) {
        activeHeadingId = heading.id;
      }
    });

    setActiveTOCLink(activeHeadingId);
  }

  function ensureScrollBinding() {
    const editor = document.getElementById("markdown-editor");
    const previewContainer = document.getElementById("preview-container");
    if (editor && !tocState.editScrollBound) {
      editor.addEventListener("scroll", updateActiveTOCItemForEdit, {
        passive: true,
      });
      tocState.editScrollBound = true;
    }

    if (previewContainer && !tocState.previewScrollBound) {
      previewContainer.addEventListener("scroll", updateActiveTOCItem, {
        passive: true,
      });
      tocState.previewScrollBound = true;
    }
  }

  function syncPreviewScroll() {
    const editor = document.getElementById("markdown-editor");
    const previewContainer = document.getElementById("preview-container");
    if (!editor || !previewContainer) {
      return;
    }

    const headings = extractHeadingsFromMarkdown(editor.value || "");
    if (headings.length === 0) {
      previewContainer.scrollTop = 0;
      return;
    }

    const lineHeight = getLineHeight(editor);
    const visibleTopLine = Math.max(0, Math.floor(editor.scrollTop / lineHeight));
    let targetHeadingId = headings[0].id;

    headings.forEach((heading) => {
      if (heading.lineNumber <= visibleTopLine + EDIT_SCROLL_ACTIVE_LINE_OFFSET) {
        targetHeadingId = heading.id;
      }
    });

    const headingElement = document.getElementById(targetHeadingId);
    if (!headingElement) {
      return;
    }

    headingElement.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
  }

  function syncEditorScroll() {
    const editor = document.getElementById("markdown-editor");
    const preview = document.getElementById("markdown-preview");
    const previewContainer = document.getElementById("preview-container");
    if (!editor || !preview || !previewContainer) {
      return;
    }

    const previewHeadings = Array.from(preview.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    if (previewHeadings.length === 0) {
      editor.scrollTop = 0;
      return;
    }
    addHeadingIds(previewHeadings);

    const previewScrollPosition = previewContainer.scrollTop + 100;
    let activePreviewIndex = 0;
    previewHeadings.forEach((heading, index) => {
      if (heading.offsetTop <= previewScrollPosition) {
        activePreviewIndex = index;
      }
    });

    const markdownHeadings = extractHeadingsFromMarkdown(editor.value || "");
    if (markdownHeadings.length === 0) {
      editor.scrollTop = 0;
      return;
    }

    const activePreviewId = previewHeadings[activePreviewIndex].id;
    let targetHeading = markdownHeadings.find((heading) => heading.id === activePreviewId);
    if (!targetHeading) {
      targetHeading = markdownHeadings[Math.min(activePreviewIndex, markdownHeadings.length - 1)];
    }
    if (!targetHeading) {
      return;
    }

    const offset = getCharacterOffsetForLine(editor.value, targetHeading.lineNumber);
    editor.setSelectionRange(offset, offset);
    scrollTextareaToLine(editor, targetHeading.lineNumber);
  }

  function generateTOC() {
    const preview = document.getElementById("markdown-preview");
    const toc = document.getElementById("toc");
    if (!toc) {
      return;
    }

    const editorContainer = document.getElementById("editor-container");
    const isEditMode = Boolean(editorContainer?.classList.contains("active"));

    let headings = [];
    if (isEditMode) {
      const editor = document.getElementById("markdown-editor");
      headings = extractHeadingsFromMarkdown(editor?.value || "");
      tocState.mode = "edit";
    } else if (preview) {
      headings = Array.from(preview.querySelectorAll("h1, h2, h3, h4, h5, h6"));
      addHeadingIds(headings);
      tocState.mode = "preview";
    }

    if (headings.length === 0) {
      toc.innerHTML = "<p>No headings</p>";
      tocState.headings = [];
      return;
    }

    tocState.headings = headings;

    const tocTree = createTOCTree(headings);
    toc.innerHTML = "";
    toc.appendChild(tocTree);
    bindTOCLinkHandlers();
    ensureScrollBinding();

    if (tocState.mode === "edit") {
      updateActiveTOCItemForEdit();
    } else {
      updateActiveTOCItem();
    }
  }

  window.generateTOC = generateTOC;
  window.syncPreviewScroll = syncPreviewScroll;
  window.syncEditorScroll = syncEditorScroll;
})();
