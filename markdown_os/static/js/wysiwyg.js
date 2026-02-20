(() => {
  const panZoomKey = "data-panzoom-initialized";
  const mermaidThemeByAppTheme = {
    light: "default",
    dark: "dark",
    dracula: "dark",
    "nord-light": "neutral",
    "nord-dark": "dark",
    lofi: "neutral",
  };

  const state = {
    root: null,
    container: null,
    changeListeners: new Set(),
    suppressInput: false,
    mermaidInitialized: false,
    mermaidTheme: null,
    fullscreenPanZoom: null,
    fullscreenPreviousFocus: null,
    blockEditTarget: null,
    blockEditType: null,
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

  function addHeadingIds(root) {
    if (!root) {
      return;
    }

    const headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const usedIds = new Map();

    headings.forEach((heading) => {
      const base = slugifyHeading(heading.textContent || "section") || "section";
      const duplicateCount = usedIds.get(base) || 0;
      usedIds.set(base, duplicateCount + 1);
      heading.id = duplicateCount === 0 ? base : `${base}-${duplicateCount + 1}`;
    });
  }

  function emitChange() {
    state.changeListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("WYSIWYG change listener failed.", error);
      }
    });
  }

  function onChange(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }

    state.changeListeners.add(listener);
    return () => {
      state.changeListeners.delete(listener);
    };
  }

  function currentMermaidTheme() {
    const currentAppTheme = document.documentElement.getAttribute("data-theme");
    return mermaidThemeByAppTheme[currentAppTheme] || "default";
  }

  function configureMarked() {
    if (!window.marked) {
      return;
    }

    window.marked.setOptions({
      gfm: true,
      breaks: true,
      mangle: false,
      headerIds: false,
    });

    window.marked.use(createMathExtension());
  }

  function escapeHtmlAttribute(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function createMathExtension() {
    const mathBlock = {
      name: "mathBlock",
      level: "block",
      start(src) {
        return src.match(/\$\$/)?.index;
      },
      tokenizer(src) {
        const match = src.match(/^\$\$[ \t]*\n?([\s\S]+?)\n?\$\$(?:\n|$)/);
        if (match) {
          return {
            type: "mathBlock",
            raw: match[0],
            text: match[1].trim(),
          };
        }
      },
      renderer(token) {
        const escaped = escapeHtmlAttribute(token.text);
        return `<div class="math-display" contenteditable="false" data-math-source="${escaped}">${escaped}</div>\n`;
      },
    };

    const mathInline = {
      name: "mathInline",
      level: "inline",
      start(src) {
        return src.match(/\$/)?.index;
      },
      tokenizer(src) {
        const match = src.match(/^\$([^\$\n]+?)\$(?!\$)/);
        if (match) {
          return {
            type: "mathInline",
            raw: match[0],
            text: match[1].trim(),
          };
        }
      },
      renderer(token) {
        const escaped = escapeHtmlAttribute(token.text);
        return `<span class="math-inline" contenteditable="false" data-math-source="${escaped}">${escaped}</span>`;
      },
    };

    return { extensions: [mathBlock, mathInline] };
  }

  function inferLanguageLabel(codeElement) {
    const languageClass = Array.from(codeElement.classList).find((className) =>
      className.startsWith("language-"),
    );
    if (!languageClass) {
      return "text";
    }
    return languageClass.replace("language-", "");
  }

  function countCodeLines(content) {
    if (!content) {
      return 1;
    }
    return Math.max(1, content.split("\n").length);
  }

  function createLineNumberGutter(lineCount) {
    const gutter = document.createElement("div");
    gutter.className = "code-line-numbers";
    gutter.setAttribute("aria-hidden", "true");

    for (let line = 1; line <= lineCount; line += 1) {
      const lineNumber = document.createElement("span");
      lineNumber.className = "code-line-number";
      lineNumber.textContent = String(line);
      gutter.appendChild(lineNumber);
    }

    return gutter;
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const fallbackInput = document.createElement("textarea");
    fallbackInput.value = text;
    fallbackInput.setAttribute("readonly", "true");
    fallbackInput.style.position = "absolute";
    fallbackInput.style.left = "-9999px";
    document.body.appendChild(fallbackInput);
    fallbackInput.select();
    document.execCommand("copy");
    document.body.removeChild(fallbackInput);
  }

  function actionIconSvg(kind) {
    if (kind === "copy") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V6a2 2 0 0 1 2-2h9"></path></svg>';
    }
    if (kind === "edit") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"></path></svg>';
    }
    if (kind === "fullscreen") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M21 8V3h-5M16 21h5v-5M3 16v5h5"></path></svg>';
    }
    return "";
  }

  function createActionButton(kind, title) {
    const button = document.createElement("button");
    button.className = "action-icon-button";
    button.type = "button";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.innerHTML = actionIconSvg(kind);
    return button;
  }

  function flashCopied(button) {
    button.classList.add("copied");
    window.setTimeout(() => {
      button.classList.remove("copied");
    }, 900);
  }

  function buildCodeBlock(codeElement) {
    const preElement = codeElement.parentElement;
    if (!preElement || preElement.closest(".code-block")) {
      return;
    }

    const languageLabel = inferLanguageLabel(codeElement);
    if (languageLabel === "mermaid") {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    wrapper.setAttribute("contenteditable", "false");

    const codeSource = codeElement.textContent || "";
    wrapper.dataset.rawSource = codeSource;
    wrapper.dataset.language = languageLabel;

    const header = document.createElement("div");
    header.className = "code-block-header";

    const content = document.createElement("div");
    content.className = "code-block-content";

    const lineCount = countCodeLines(codeSource);
    const lineNumberGutter = createLineNumberGutter(lineCount);

    const label = document.createElement("span");
    label.className = "code-language-label";
    label.textContent = languageLabel;

    const actions = document.createElement("div");
    actions.className = "code-block-actions";

    const copyButton = createActionButton("copy", "Copy code");
    copyButton.classList.add("copy-button");
    copyButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await copyToClipboard(wrapper.dataset.rawSource || "");
        flashCopied(copyButton);
      } catch (error) {
        console.error("Failed to copy code content.", error);
      }
    });

    const editButton = createActionButton("edit", "Edit code block");
    editButton.classList.add("block-edit-trigger");
    editButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openBlockEditor("code", wrapper);
    });

    actions.appendChild(editButton);
    actions.appendChild(copyButton);

    header.appendChild(label);
    header.appendChild(actions);
    preElement.replaceWith(wrapper);
    wrapper.appendChild(header);
    wrapper.appendChild(content);
    content.appendChild(lineNumberGutter);
    content.appendChild(preElement);

    if (window.hljs && !codeElement.classList.contains("hljs")) {
      window.hljs.highlightElement(codeElement);
    }
  }

  function decorateCodeBlocks() {
    if (!state.root) {
      return;
    }

    state.root.querySelectorAll("pre > code").forEach((codeElement) => {
      buildCodeBlock(codeElement);
    });
  }

  function renderMathError(element, source, displayMode) {
    if (displayMode) {
      element.innerHTML = "";
      const errorBlock = document.createElement("div");
      errorBlock.className = "math-error-block";
      errorBlock.textContent = `Invalid LaTeX:\n${source}`;
      element.appendChild(errorBlock);
      return;
    }

    element.classList.add("math-error");
    element.title = `Invalid LaTeX: ${source}`;
  }

  function renderMathEquations() {
    if (!window.katex || !state.root) {
      return;
    }

    state.root.querySelectorAll(".math-inline").forEach((element) => {
      const source = element.getAttribute("data-math-source") || element.textContent || "";
      try {
        window.katex.render(source, element, {
          throwOnError: false,
          displayMode: false,
          output: "htmlAndMathml",
        });
      } catch (error) {
        console.error("KaTeX inline render error.", error);
        renderMathError(element, source, false);
      }
    });

    state.root.querySelectorAll(".math-display").forEach((element) => {
      const source = element.getAttribute("data-math-source") || element.textContent || "";
      try {
        window.katex.render(source, element, {
          throwOnError: false,
          displayMode: true,
          output: "htmlAndMathml",
        });

        const existingActions = element.querySelector(".math-block-actions");
        if (existingActions) {
          existingActions.remove();
        }

        const actions = document.createElement("div");
        actions.className = "math-block-actions";

        const copyButton = createActionButton("copy", "Copy LaTeX");
        copyButton.classList.add("copy-button", "math-copy-button");
        copyButton.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          try {
            const latestSource = element.getAttribute("data-math-source") || "";
            await copyToClipboard(latestSource);
            flashCopied(copyButton);
          } catch (error) {
            console.error("Failed to copy LaTeX content.", error);
          }
        });

        const editButton = createActionButton("edit", "Edit equation");
        editButton.classList.add("block-edit-trigger", "math-copy-button");
        editButton.style.right = "40px";
        editButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openBlockEditor("math-display", element);
        });

        actions.appendChild(editButton);
        actions.appendChild(copyButton);
        element.appendChild(actions);
      } catch (error) {
        console.error("KaTeX display render error.", error);
        renderMathError(element, source, true);
      }
    });
  }

  function ensureMermaidInitialized() {
    if (!window.mermaid) {
      return;
    }

    const theme = currentMermaidTheme();
    if (state.mermaidInitialized && state.mermaidTheme === theme) {
      return;
    }

    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme,
      useMaxWidth: false,
    });
    state.mermaidInitialized = true;
    state.mermaidTheme = theme;
  }

  function renderMermaidError(container, source) {
    container.innerHTML = `<div class="mermaid-error">Invalid mermaid syntax:\n${source}</div>`;
  }

  function addMermaidControls(container) {
    const existingEdit = container.querySelector(".block-edit-trigger");
    if (!existingEdit) {
      const editButton = createActionButton("edit", "Edit diagram");
      editButton.classList.add("block-edit-trigger");
      editButton.style.position = "absolute";
      editButton.style.top = "8px";
      editButton.style.right = "42px";
      editButton.style.zIndex = "2";
      editButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openBlockEditor("mermaid", container);
      });
      container.appendChild(editButton);
    }

    const existingFullscreenButton = container.querySelector(".mermaid-fullscreen-trigger");
    if (!existingFullscreenButton) {
      const fullscreenButton = createActionButton("fullscreen", "View diagram fullscreen");
      fullscreenButton.classList.add("mermaid-fullscreen-trigger");
      fullscreenButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const source = container.dataset.mermaidSource || "";
        const svg = container.querySelector("svg");
        openMermaidFullscreen(source, svg);
      });
      container.appendChild(fullscreenButton);
    }

    let controls = container.querySelector(".mermaid-zoom-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "mermaid-zoom-controls";

      const zoomIn = document.createElement("button");
      zoomIn.className = "mermaid-zoom-btn";
      zoomIn.type = "button";
      zoomIn.title = "Zoom in";
      zoomIn.textContent = "+";
      zoomIn.addEventListener("click", () => {
        container._panZoomInstance?.zoomIn();
      });

      const reset = document.createElement("button");
      reset.className = "mermaid-zoom-btn";
      reset.type = "button";
      reset.title = "Reset view";
      reset.textContent = "↻";
      reset.addEventListener("click", () => {
        const pz = container._panZoomInstance;
        if (!pz) {
          return;
        }

        pz.resetZoom();
        pz.resetPan();
        pz.fit();
        pz.center();
      });

      const zoomOut = document.createElement("button");
      zoomOut.className = "mermaid-zoom-btn";
      zoomOut.type = "button";
      zoomOut.title = "Zoom out";
      zoomOut.textContent = "−";
      zoomOut.addEventListener("click", () => {
        container._panZoomInstance?.zoomOut();
      });

      controls.appendChild(zoomIn);
      controls.appendChild(reset);
      controls.appendChild(zoomOut);
      container.appendChild(controls);
    }
  }

  function fixMermaidSvgDimensions() {
    if (!state.root) {
      return;
    }

    state.root.querySelectorAll(".mermaid-container svg").forEach((svg) => {
      const container = svg.closest(".mermaid-container");
      if (!container) {
        return;
      }

      svg.style.maxWidth = "";
      svg.style.width = "100%";

      try {
        const bbox = svg.getBBox();
        if (bbox.width <= 0) {
          return;
        }
        const containerWidth = container.clientWidth || container.offsetWidth;
        if (!containerWidth) {
          return;
        }
        const naturalHeight = containerWidth * (bbox.height / bbox.width);
        svg.style.height = `${Math.ceil(naturalHeight)}px`;
      } catch (_error) {
        // Ignore detached or invalid SVG bounds failures.
      }
    });
  }

  function applyZoomToDiagrams() {
    if (!window.svgPanZoom || !state.root) {
      return;
    }

    state.root.querySelectorAll(".mermaid-container svg").forEach((svgElement) => {
      if (svgElement.getAttribute(panZoomKey) === "true") {
        return;
      }

      const container = svgElement.closest(".mermaid-container");
      const instance = window.svgPanZoom(svgElement, {
        controlIconsEnabled: false,
        zoomScaleSensitivity: 0.4,
        minZoom: 0.5,
        maxZoom: 20,
        fit: true,
        center: true,
      });
      svgElement.setAttribute(panZoomKey, "true");
      if (container) {
        container._panZoomInstance = instance;
      }
    });
  }

  async function renderMermaidDiagrams() {
    if (!window.mermaid || !state.root) {
      return;
    }

    ensureMermaidInitialized();

    const mermaidCodeBlocks = state.root.querySelectorAll(
      "pre > code.language-mermaid, pre > code.lang-mermaid",
    );

    mermaidCodeBlocks.forEach((codeElement) => {
      const preElement = codeElement.parentElement;
      if (!preElement) {
        return;
      }

      const sourceContent = codeElement.textContent || "";

      const mermaidContainer = document.createElement("div");
      mermaidContainer.className = "mermaid-container";
      mermaidContainer.setAttribute("contenteditable", "false");
      mermaidContainer.dataset.mermaidSource = sourceContent;

      const mermaidElement = document.createElement("div");
      mermaidElement.className = "mermaid";
      mermaidElement.textContent = sourceContent;
      mermaidElement.setAttribute("data-original-content", sourceContent);
      mermaidContainer.appendChild(mermaidElement);

      preElement.replaceWith(mermaidContainer);
    });

    const mermaidNodes = Array.from(
      state.root.querySelectorAll(".mermaid-container .mermaid"),
    );

    if (mermaidNodes.length === 0) {
      return;
    }

    try {
      await window.mermaid.run({
        nodes: mermaidNodes,
      });
      fixMermaidSvgDimensions();
      applyZoomToDiagrams();
      state.root.querySelectorAll(".mermaid-container").forEach((container) => {
        addMermaidControls(container);
      });
    } catch (error) {
      console.error("Mermaid render error.", error);
      state.root.querySelectorAll(".mermaid-container").forEach((container) => {
        renderMermaidError(container, container.dataset.mermaidSource || "");
      });
    }
  }

  function setTaskCheckboxClasses(checkbox) {
    const item = checkbox.closest("li");
    if (!item) {
      return;
    }

    item.classList.add("task-list-item");
    if (checkbox.checked) {
      item.classList.add("is-checked");
    } else {
      item.classList.remove("is-checked");
    }
  }

  function makeTaskListsInteractive() {
    if (!state.root) {
      return;
    }

    state.root.querySelectorAll('li > input[type="checkbox"]').forEach((checkbox) => {
      checkbox.removeAttribute("disabled");
      checkbox.setAttribute("contenteditable", "false");
      setTaskCheckboxClasses(checkbox);

      const parentList = checkbox.closest("ul, ol");
      if (parentList) {
        parentList.classList.add("task-list");
      }
    });
  }

  function decorateLinks() {
    if (!state.root) {
      return;
    }

    state.root.querySelectorAll("a[href]").forEach((link) => {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });
  }

  async function decorateDocument() {
    if (!state.root) {
      return;
    }

    addHeadingIds(state.root);
    decorateCodeBlocks();
    renderMathEquations();
    await renderMermaidDiagrams();
    makeTaskListsInteractive();
    decorateLinks();
  }

  function getTurndownService() {
    if (!window.TurndownService) {
      return null;
    }

    const turndownService = new window.TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
    });

    if (window.turndownPluginGfm?.gfm) {
      turndownService.use(window.turndownPluginGfm.gfm);
    }

    turndownService.addRule("mathDisplay", {
      filter(node) {
        return (
          node.nodeType === Node.ELEMENT_NODE &&
          node.nodeName === "DIV" &&
          node.classList.contains("math-display")
        );
      },
      replacement(_content, node) {
        const source = node.getAttribute("data-math-source") || "";
        return `\n\n$$\n${source}\n$$\n\n`;
      },
    });

    turndownService.addRule("mathInline", {
      filter(node) {
        return (
          node.nodeType === Node.ELEMENT_NODE &&
          node.nodeName === "SPAN" &&
          node.classList.contains("math-inline")
        );
      },
      replacement(_content, node) {
        const source = node.getAttribute("data-math-source") || "";
        return `$${source}$`;
      },
    });

    turndownService.addRule("fencedCode", {
      filter(node) {
        return node.nodeType === Node.ELEMENT_NODE && node.nodeName === "PRE";
      },
      replacement(_content, node) {
        const codeNode = node.firstElementChild;
        if (!codeNode || codeNode.nodeName !== "CODE") {
          return "\n\n```\n```\n\n";
        }

        const codeText = codeNode.textContent || "";
        const languageClass = Array.from(codeNode.classList).find((className) =>
          className.startsWith("language-"),
        );
        const language = languageClass ? languageClass.replace("language-", "") : "";

        return `\n\n\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
      },
    });

    return turndownService;
  }

  function cleanupForSerialization(cloneRoot) {
    cloneRoot.querySelectorAll(".copy-button, .block-edit-trigger, .mermaid-fullscreen-trigger").forEach((node) => {
      node.remove();
    });
    cloneRoot.querySelectorAll(".mermaid-zoom-controls, .code-line-numbers").forEach((node) => {
      node.remove();
    });

    cloneRoot.querySelectorAll(".code-block").forEach((wrapper) => {
      const source = wrapper.dataset.rawSource || wrapper.querySelector("pre code")?.textContent || "";
      const language = wrapper.dataset.language || "";
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      if (language) {
        code.className = `language-${language}`;
      }
      code.textContent = source;
      pre.appendChild(code);
      wrapper.replaceWith(pre);
    });

    cloneRoot.querySelectorAll(".mermaid-container").forEach((container) => {
      const source = container.dataset.mermaidSource || "";
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.className = "language-mermaid";
      code.textContent = source;
      pre.appendChild(code);
      container.replaceWith(pre);
    });

    cloneRoot.querySelectorAll('li > input[type="checkbox"]').forEach((checkbox) => {
      if (checkbox.checked) {
        checkbox.setAttribute("checked", "checked");
      } else {
        checkbox.removeAttribute("checked");
      }
    });
  }

  function getMarkdown() {
    if (!state.root) {
      return "";
    }

    const cloneRoot = state.root.cloneNode(true);
    cleanupForSerialization(cloneRoot);

    const turndownService = getTurndownService();
    if (!turndownService) {
      return state.root.textContent || "";
    }

    const markdown = turndownService.turndown(cloneRoot).replace(/\n{3,}/g, "\n\n").trim();
    return markdown;
  }

  async function setMarkdown(markdown, options = {}) {
    const { silent = false } = options;
    if (!state.root || !window.marked) {
      return;
    }

    state.suppressInput = true;
    state.root.innerHTML = window.marked.parse(markdown || "");
    await decorateDocument();
    state.suppressInput = false;

    if (!silent) {
      emitChange();
    }
  }

  function insertHtmlAtSelection(html) {
    if (!state.root) {
      return;
    }

    state.root.focus();
    document.execCommand("insertHTML", false, html);
  }

  function closestCodeElement(node) {
    if (!node) {
      return null;
    }

    const startNode = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!startNode) {
      return null;
    }

    const code = startNode.closest("code");
    if (!code || !state.root?.contains(code)) {
      return null;
    }
    return code;
  }

  function unwrapCodeElement(codeElement) {
    if (!codeElement || !codeElement.parentNode) {
      return null;
    }

    const textNode = document.createTextNode(codeElement.textContent || "");
    codeElement.replaceWith(textNode);
    return textNode;
  }

  async function insertImage(path, alt = "image") {
    insertHtmlAtSelection(`<p><img src="${path}" alt="${alt}" /></p><p><br></p>`);
    await decorateDocument();
    emitChange();
  }

  function createTableTemplate() {
    return `
      <table>
        <thead>
          <tr>
            <th>Column 1</th>
            <th>Column 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Value</td>
            <td>Value</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>`;
  }

  async function executeCommand(command, payload = {}) {
    if (!state.root) {
      return;
    }

    state.root.focus();

    if (command === "bold") {
      document.execCommand("bold", false);
      emitChange();
      return;
    }

    if (command === "italic") {
      document.execCommand("italic", false);
      emitChange();
      return;
    }

    if (command === "strike") {
      document.execCommand("strikeThrough", false);
      emitChange();
      return;
    }

    if (command === "inlineCode") {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (!state.root.contains(range.commonAncestorContainer)) {
        return;
      }

      const startCode = closestCodeElement(range.startContainer);
      const endCode = closestCodeElement(range.endContainer);
      const singleCodeSelection = startCode && endCode && startCode === endCode;

      if (range.collapsed) {
        if (startCode) {
          const textNode = unwrapCodeElement(startCode);
          if (textNode) {
            const nextRange = document.createRange();
            nextRange.setStart(textNode, textNode.textContent.length);
            nextRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(nextRange);
            emitChange();
          }
          return;
        }

        insertHtmlAtSelection("<code>code</code>");
        emitChange();
        return;
      }

      const selectedText = selection.toString();
      if (!selectedText || selectedText.includes("\n")) {
        return;
      }

      if (singleCodeSelection) {
        const textNode = unwrapCodeElement(startCode);
        if (textNode) {
          const nextRange = document.createRange();
          nextRange.selectNodeContents(textNode);
          selection.removeAllRanges();
          selection.addRange(nextRange);
          emitChange();
        }
        return;
      }

      const codeNode = document.createElement("code");
      codeNode.textContent = selectedText;
      range.deleteContents();
      range.insertNode(codeNode);
      const nextRange = document.createRange();
      nextRange.selectNodeContents(codeNode);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      emitChange();
      return;
    }

    if (command === "h1" || command === "h2" || command === "h3") {
      document.execCommand("formatBlock", false, command.toUpperCase());
      addHeadingIds(state.root);
      emitChange();
      return;
    }

    if (command === "bulletList") {
      document.execCommand("insertUnorderedList", false);
      emitChange();
      return;
    }

    if (command === "orderedList") {
      document.execCommand("insertOrderedList", false);
      emitChange();
      return;
    }

    if (command === "blockquote") {
      document.execCommand("formatBlock", false, "BLOCKQUOTE");
      emitChange();
      return;
    }

    if (command === "link") {
      const selectedText = window.getSelection()?.toString() || "";
      const existing = payload.url || "https://";
      const linkUrl = window.prompt("Enter URL", existing);
      if (!linkUrl) {
        return;
      }

      if (selectedText) {
        document.execCommand("createLink", false, linkUrl);
      } else {
        insertHtmlAtSelection(`<a href="${linkUrl}">${linkUrl}</a>`);
      }
      decorateLinks();
      emitChange();
      return;
    }

    if (command === "horizontalRule") {
      document.execCommand("insertHorizontalRule", false);
      emitChange();
      return;
    }

    if (command === "taskList") {
      insertHtmlAtSelection(
        '<ul class="task-list"><li class="task-list-item"><input type="checkbox" contenteditable="false" /> Task</li></ul><p><br></p>',
      );
      makeTaskListsInteractive();
      emitChange();
      return;
    }

    if (command === "math") {
      insertHtmlAtSelection(
        '<div class="math-display" contenteditable="false" data-math-source="x^2 + y^2 = z^2"></div><p><br></p>',
      );
      renderMathEquations();
      emitChange();
      return;
    }

    if (command === "codeBlock") {
      insertHtmlAtSelection('<pre><code class="language-text">// code</code></pre><p><br></p>');
      decorateCodeBlocks();
      emitChange();
      return;
    }

    if (command === "table") {
      insertHtmlAtSelection(createTableTemplate());
      emitChange();
      return;
    }

    if (command === "image") {
      if (payload.path) {
        await insertImage(payload.path, payload.alt || "image");
        return;
      }

      const imageUrl = window.prompt("Image URL");
      if (!imageUrl) {
        return;
      }
      await insertImage(imageUrl, "image");
      return;
    }

    if (command === "mermaid") {
      insertHtmlAtSelection('<pre><code class="language-mermaid">graph TD\n  A[Start] --> B[End]</code></pre><p><br></p>');
      await renderMermaidDiagrams();
      emitChange();
    }
  }

  function getHeadingElements() {
    if (!state.root) {
      return [];
    }
    return Array.from(state.root.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  }

  function scrollHeadingIntoView(id) {
    if (!state.root || !id) {
      return;
    }

    const heading = state.root.querySelector(`#${CSS.escape(id)}`);
    if (!heading) {
      return;
    }

    heading.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function getScrollTop() {
    return state.container?.scrollTop || 0;
  }

  function setScrollTop(value) {
    if (!state.container) {
      return;
    }

    state.container.scrollTop = Math.max(0, Number(value) || 0);
  }

  function focus() {
    state.root?.focus();
  }

  function undo() {
    document.execCommand("undo", false);
    emitChange();
  }

  function redo() {
    document.execCommand("redo", false);
    emitChange();
  }

  function closeBlockEditor() {
    const overlay = document.getElementById("block-edit-overlay");
    const modal = document.getElementById("block-edit-modal");
    if (!overlay || !modal) {
      return;
    }

    overlay.classList.add("hidden");
    modal.classList.add("hidden");
    state.blockEditTarget = null;
    state.blockEditType = null;
  }

  async function applyBlockEdit() {
    const sourceInput = document.getElementById("block-edit-source");
    const languageInput = document.getElementById("block-edit-language");
    if (!sourceInput || !state.blockEditTarget || !state.blockEditType) {
      closeBlockEditor();
      return;
    }

    const source = sourceInput.value;

    if (state.blockEditType === "code") {
      const language = languageInput?.value?.trim() || "text";
      state.blockEditTarget.dataset.rawSource = source;
      state.blockEditTarget.dataset.language = language;
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.className = `language-${language}`;
      code.textContent = source;
      pre.appendChild(code);

      const content = state.blockEditTarget.querySelector(".code-block-content");
      if (content) {
        content.innerHTML = "";
        content.appendChild(createLineNumberGutter(countCodeLines(source)));
        content.appendChild(pre);
      }
      const label = state.blockEditTarget.querySelector(".code-language-label");
      if (label) {
        label.textContent = language;
      }

      if (window.hljs) {
        window.hljs.highlightElement(code);
      }
      closeBlockEditor();
      emitChange();
      return;
    }

    if (state.blockEditType === "mermaid") {
      state.blockEditTarget.dataset.mermaidSource = source;
      state.blockEditTarget.innerHTML = `<div class="mermaid" data-original-content="${escapeHtmlAttribute(source)}">${source}</div>`;
      addMermaidControls(state.blockEditTarget);
      await renderMermaidDiagrams();
      closeBlockEditor();
      emitChange();
      return;
    }

    if (state.blockEditType === "math-display" || state.blockEditType === "math-inline") {
      state.blockEditTarget.setAttribute("data-math-source", source);
      state.blockEditTarget.textContent = source;
      renderMathEquations();
      closeBlockEditor();
      emitChange();
    }
  }

  function openBlockEditor(type, target) {
    const overlay = document.getElementById("block-edit-overlay");
    const modal = document.getElementById("block-edit-modal");
    const title = document.getElementById("block-edit-title");
    const sourceInput = document.getElementById("block-edit-source");
    const languageInput = document.getElementById("block-edit-language");
    const languageLabel = document.getElementById("block-edit-language-label");

    if (!overlay || !modal || !title || !sourceInput || !languageInput || !languageLabel) {
      return;
    }

    state.blockEditTarget = target;
    state.blockEditType = type;

    if (type === "code") {
      title.textContent = "Edit code block";
      sourceInput.value = target.dataset.rawSource || "";
      languageInput.value = target.dataset.language || "text";
      languageInput.classList.remove("hidden");
      languageLabel.classList.remove("hidden");
    } else if (type === "mermaid") {
      title.textContent = "Edit Mermaid diagram";
      sourceInput.value = target.dataset.mermaidSource || "";
      languageInput.classList.add("hidden");
      languageLabel.classList.add("hidden");
    } else if (type === "math-display") {
      title.textContent = "Edit display equation";
      sourceInput.value = target.getAttribute("data-math-source") || "";
      languageInput.classList.add("hidden");
      languageLabel.classList.add("hidden");
    } else {
      title.textContent = "Edit inline equation";
      sourceInput.value = target.getAttribute("data-math-source") || "";
      languageInput.classList.add("hidden");
      languageLabel.classList.add("hidden");
    }

    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");
    sourceInput.focus();
    sourceInput.select();
  }

  async function openMermaidFullscreen(mermaidSource, fallbackSvg) {
    const overlay = document.getElementById("mermaid-fullscreen-overlay");
    const modal = document.getElementById("mermaid-fullscreen-modal");
    const content = document.getElementById("mermaid-fullscreen-content");
    if (!overlay || !modal || !content) {
      return;
    }

    if (!modal.classList.contains("hidden")) {
      closeMermaidFullscreen();
    }

    state.fullscreenPreviousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    content.innerHTML = "";

    let svgElement = null;

    if (mermaidSource && window.mermaid) {
      try {
        ensureMermaidInitialized();
        const fullscreenId = `mermaid-fullscreen-${Date.now()}`;
        const result = await window.mermaid.render(fullscreenId, mermaidSource);
        content.innerHTML = result.svg;
        svgElement = content.querySelector("svg");
      } catch (error) {
        console.error("Mermaid fullscreen render error.", error);
      }
    }

    if (!svgElement && fallbackSvg instanceof SVGElement) {
      const clone = fallbackSvg.cloneNode(true);
      if (clone instanceof SVGElement) {
        clone.removeAttribute(panZoomKey);
        clone.removeAttribute("style");
        content.appendChild(clone);
        svgElement = clone;
      }
    }

    if (!svgElement) {
      return;
    }

    svgElement.setAttribute("width", "100%");
    svgElement.setAttribute("height", "100%");
    svgElement.style.maxWidth = "";
    svgElement.style.width = "100%";
    svgElement.style.height = "100%";

    overlay.classList.remove("hidden");
    modal.classList.remove("hidden");

    if (window.svgPanZoom) {
      state.fullscreenPanZoom = window.svgPanZoom(svgElement, {
        controlIconsEnabled: false,
        zoomScaleSensitivity: 0.4,
        minZoom: 0.2,
        maxZoom: 40,
        fit: false,
        center: true,
      });
      state.fullscreenPanZoom.center();
    }

    document.getElementById("mermaid-fullscreen-close")?.focus();
  }

  function closeMermaidFullscreen() {
    const overlay = document.getElementById("mermaid-fullscreen-overlay");
    const modal = document.getElementById("mermaid-fullscreen-modal");
    const content = document.getElementById("mermaid-fullscreen-content");
    if (!overlay || !modal) {
      return;
    }

    if (state.fullscreenPanZoom) {
      state.fullscreenPanZoom.destroy();
      state.fullscreenPanZoom = null;
    }

    overlay.classList.add("hidden");
    modal.classList.add("hidden");
    if (content) {
      content.innerHTML = "";
    }

    if (state.fullscreenPreviousFocus) {
      state.fullscreenPreviousFocus.focus();
    }
    state.fullscreenPreviousFocus = null;
  }

  function isWithinNonEditable(node) {
    return Boolean(node?.parentElement?.closest('[contenteditable="false"]'));
  }

  function closestEditableBlock(node) {
    if (!node || !state.root) {
      return null;
    }

    const startNode = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!startNode || !state.root.contains(startNode)) {
      return null;
    }

    return startNode.closest(
      "p, div, li, blockquote, h1, h2, h3, h4, h5, h6",
    );
  }

  function placeCaretAtStart(node) {
    const selection = window.getSelection();
    if (!selection || !node) {
      return;
    }

    const range = document.createRange();
    if (!node.firstChild) {
      node.appendChild(document.createElement("br"));
    }
    range.setStart(node, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretAtEnd(node) {
    const selection = window.getSelection();
    if (!selection || !node) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretAtNodeStart(node) {
    const selection = window.getSelection();
    if (!selection || !node) {
      return;
    }

    const range = document.createRange();
    if (node.firstChild) {
      range.setStart(node.firstChild, 0);
    } else {
      range.setStart(node, 0);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function isRangeAtElementStart(range, element) {
    const probe = range.cloneRange();
    probe.setStart(element, 0);
    const prefixText = (probe.toString() || "").replace(/\u00a0/g, " ").trim();
    return prefixText.length === 0;
  }

  function createParagraphFromListItem(listItem) {
    const paragraph = document.createElement("p");
    const fragment = document.createDocumentFragment();

    Array.from(listItem.childNodes).forEach((node) => {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.nodeName === "INPUT" &&
        node.getAttribute("type") === "checkbox"
      ) {
        return;
      }
      fragment.appendChild(node.cloneNode(true));
    });

    paragraph.appendChild(fragment);

    if (paragraph.firstChild?.nodeType === Node.TEXT_NODE) {
      paragraph.firstChild.textContent = paragraph.firstChild.textContent.replace(/^\s+/, "");
    }

    const normalizedText = (paragraph.textContent || "").replace(/\u00a0/g, " ").trim();
    if (!normalizedText && !paragraph.querySelector("img, code, a, strong, em, del, span, math")) {
      paragraph.innerHTML = "<br>";
    }

    return paragraph;
  }

  function unwrapListItemToParagraph(listItem) {
    const list = listItem?.parentElement;
    if (!list || (list.nodeName !== "UL" && list.nodeName !== "OL")) {
      return null;
    }

    const paragraph = createParagraphFromListItem(listItem);
    const parent = list.parentNode;
    if (!parent) {
      return null;
    }

    const listItems = Array.from(list.children).filter((node) => node.nodeName === "LI");
    const itemIndex = listItems.indexOf(listItem);
    const isOnlyItem = listItems.length === 1;

    if (isOnlyItem) {
      parent.replaceChild(paragraph, list);
      return paragraph;
    }

    if (list.firstElementChild === listItem) {
      parent.insertBefore(paragraph, list);
      listItem.remove();
      return paragraph;
    }

    if (list.lastElementChild === listItem) {
      listItem.remove();
      if (list.nextSibling) {
        parent.insertBefore(paragraph, list.nextSibling);
      } else {
        parent.appendChild(paragraph);
      }
      return paragraph;
    }

    const trailingList = list.cloneNode(false);
    let current = listItem.nextSibling;
    while (current) {
      const next = current.nextSibling;
      trailingList.appendChild(current);
      current = next;
    }

    listItem.remove();
    if (list.nextSibling) {
      parent.insertBefore(paragraph, list.nextSibling);
      parent.insertBefore(trailingList, paragraph.nextSibling);
    } else {
      parent.appendChild(paragraph);
      parent.appendChild(trailingList);
    }

    return paragraph;
  }

  function replaceInlineMatch(textNode, offset, pattern, tagName) {
    const beforeCursor = textNode.textContent?.slice(0, offset) || "";
    const match = beforeCursor.match(pattern);
    if (!match) {
      return false;
    }

    const fullMatch = match[0];
    const content = match[1];
    const trailingSpace = match[2] || "";
    const startOffset = beforeCursor.length - fullMatch.length;
    if (startOffset < 0) {
      return false;
    }

    const range = document.createRange();
    range.setStart(textNode, startOffset);
    range.setEnd(textNode, offset);
    range.deleteContents();

    const markNode = document.createElement(tagName);
    markNode.textContent = content;
    range.insertNode(markNode);
    let spacer = null;
    if (trailingSpace) {
      spacer = document.createTextNode(trailingSpace);
      markNode.after(spacer);
    }

    const selection = window.getSelection();
    if (selection) {
      const nextRange = document.createRange();
      if (spacer) {
        nextRange.setStart(spacer, trailingSpace.length);
      } else {
        nextRange.setStartAfter(markNode);
      }
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }

    return true;
  }

  function applyInlineMarkdownShortcut() {
    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed) {
      return false;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE || isWithinNonEditable(anchorNode)) {
      return false;
    }
    if (closestCodeElement(anchorNode)) {
      return false;
    }

    const offset = selection.anchorOffset;
    if (offset <= 0) {
      return false;
    }

    const patterns = [
      { regex: /\*\*([^*\n]+)\*\*(\s?)$/, tag: "strong" },
      { regex: /__([^_\n]+)__(\s?)$/, tag: "strong" },
      { regex: /~~([^~\n]+)~~(\s?)$/, tag: "del" },
      { regex: /`([^`\n]+)`(\s?)$/, tag: "code" },
      { regex: /\*([^*\n]+)\*(\s?)$/, tag: "em" },
      { regex: /_([^_\n]+)_(\s?)$/, tag: "em" },
    ];

    for (const { regex, tag } of patterns) {
      if (replaceInlineMatch(anchorNode, offset, regex, tag)) {
        return true;
      }
    }

    return false;
  }

  function applyBlockMarkdownShortcut() {
    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed || !state.root) {
      return false;
    }

    const block = closestEditableBlock(selection.anchorNode);
    if (!block || block === state.root || isWithinNonEditable(block)) {
      return false;
    }

    const blockText = (block.textContent || "").replace(/\u00a0/g, " ");

    const headingMatch = blockText.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2] || "";
      const heading = document.createElement(`h${level}`);
      if (content) {
        heading.textContent = content;
      } else {
        heading.innerHTML = "<br>";
      }
      block.replaceWith(heading);
      addHeadingIds(state.root);
      placeCaretAtEnd(heading);
      return true;
    }

    const quoteMatch = blockText.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      const content = quoteMatch[1] || "";
      const quote = document.createElement("blockquote");
      const paragraph = document.createElement("p");
      if (content) {
        paragraph.textContent = content;
      } else {
        paragraph.innerHTML = "<br>";
      }
      quote.appendChild(paragraph);
      block.replaceWith(quote);
      placeCaretAtEnd(paragraph);
      return true;
    }

    const unorderedMatch = blockText.match(/^[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      const content = unorderedMatch[1] || "";
      const list = document.createElement("ul");
      const item = document.createElement("li");
      if (content) {
        item.textContent = content;
      } else {
        item.innerHTML = "<br>";
      }
      list.appendChild(item);
      block.replaceWith(list);
      placeCaretAtEnd(item);
      return true;
    }

    const orderedMatch = blockText.match(/^(\d+)[.)]\s+(.*)$/);
    if (orderedMatch) {
      const start = Number.parseInt(orderedMatch[1], 10) || 1;
      const content = orderedMatch[2] || "";
      const list = document.createElement("ol");
      if (start > 1) {
        list.start = start;
      }
      const item = document.createElement("li");
      if (content) {
        item.textContent = content;
      } else {
        item.innerHTML = "<br>";
      }
      list.appendChild(item);
      block.replaceWith(list);
      placeCaretAtEnd(item);
      return true;
    }

    const taskMatch = blockText.match(/^[-*+]\s+\[( |x|X)\]\s*(.*)$/);
    if (taskMatch) {
      const checked = (taskMatch[1] || "").toLowerCase() === "x";
      const content = taskMatch[2] || "";
      const list = document.createElement("ul");
      list.className = "task-list";
      const item = document.createElement("li");
      item.className = "task-list-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = checked;
      checkbox.setAttribute("contenteditable", "false");
      const label = document.createTextNode(content ? ` ${content}` : " ");
      item.appendChild(checkbox);
      item.appendChild(label);
      list.appendChild(item);
      block.replaceWith(list);
      makeTaskListsInteractive();
      placeCaretAtEnd(item);
      return true;
    }

    return false;
  }

  async function handleRootKeyUp(event) {
    if (state.suppressInput) {
      return;
    }

    const isSpaceKey = event.key === " " || event.key === "Spacebar";
    const shouldCheckInline = isSpaceKey || event.key === "*" || event.key === "_" || event.key === "`" || event.key === "~";
    if (!isSpaceKey && !shouldCheckInline) {
      return;
    }

    let didTransform = false;
    if (isSpaceKey) {
      didTransform = applyBlockMarkdownShortcut();
    }
    if (!didTransform) {
      didTransform = applyInlineMarkdownShortcut();
    }

    if (!didTransform) {
      return;
    }

    await decorateDocument();
    emitChange();
  }

  async function handleRootKeyDown(event) {
    if (state.suppressInput || event.key !== "Backspace") {
      return;
    }

    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode || isWithinNonEditable(anchorNode)) {
      return;
    }

    const listItem =
      (anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode)?.closest("li");
    if (!listItem || !state.root?.contains(listItem)) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!isRangeAtElementStart(range, listItem)) {
      return;
    }

    const replacementParagraph = unwrapListItemToParagraph(listItem);
    if (!replacementParagraph) {
      return;
    }

    event.preventDefault();
    placeCaretAtNodeStart(replacementParagraph);
    await decorateDocument();
    emitChange();
  }

  function handleRootInput() {
    if (state.suppressInput) {
      return;
    }

    addHeadingIds(state.root);
    emitChange();
  }

  function handleRootChange(event) {
    const checkbox = event.target.closest('input[type="checkbox"]');
    if (!checkbox) {
      return;
    }

    setTaskCheckboxClasses(checkbox);
    emitChange();
  }

  function handleRootClick(event) {
    const block = event.target.closest(".code-block, .mermaid-container, .math-display, .math-inline");
    if (!block || event.target.closest("button, a, input")) {
      return;
    }

    if (block.classList.contains("code-block")) {
      openBlockEditor("code", block);
    } else if (block.classList.contains("mermaid-container")) {
      openBlockEditor("mermaid", block);
    } else if (block.classList.contains("math-display")) {
      openBlockEditor("math-display", block);
    } else if (block.classList.contains("math-inline")) {
      openBlockEditor("math-inline", block);
    }
  }

  function bindFullscreenListeners() {
    const zoomInButton = document.getElementById("mermaid-zoom-in");
    const zoomOutButton = document.getElementById("mermaid-zoom-out");
    const resetButton = document.getElementById("mermaid-zoom-reset");
    const closeButton = document.getElementById("mermaid-fullscreen-close");
    const overlay = document.getElementById("mermaid-fullscreen-overlay");

    zoomInButton?.addEventListener("click", () => {
      state.fullscreenPanZoom?.zoomIn();
    });
    zoomOutButton?.addEventListener("click", () => {
      state.fullscreenPanZoom?.zoomOut();
    });
    resetButton?.addEventListener("click", () => {
      state.fullscreenPanZoom?.resetZoom();
      state.fullscreenPanZoom?.resetPan();
      state.fullscreenPanZoom?.fit();
      state.fullscreenPanZoom?.center();
    });
    closeButton?.addEventListener("click", closeMermaidFullscreen);
    overlay?.addEventListener("click", closeMermaidFullscreen);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const fullscreenModal = document.getElementById("mermaid-fullscreen-modal");
        if (fullscreenModal && !fullscreenModal.classList.contains("hidden")) {
          closeMermaidFullscreen();
          return;
        }

        const editModal = document.getElementById("block-edit-modal");
        if (editModal && !editModal.classList.contains("hidden")) {
          closeBlockEditor();
        }
      }
    });
  }

  function bindBlockEditListeners() {
    const overlay = document.getElementById("block-edit-overlay");
    const applyButton = document.getElementById("block-edit-apply");
    const cancelButton = document.getElementById("block-edit-cancel");

    overlay?.addEventListener("click", closeBlockEditor);
    cancelButton?.addEventListener("click", closeBlockEditor);
    applyButton?.addEventListener("click", () => {
      applyBlockEdit();
    });
  }

  async function rerenderMermaidDiagramsForTheme() {
    if (!state.root || !window.mermaid) {
      return;
    }

    ensureMermaidInitialized();
    const diagrams = state.root.querySelectorAll(".mermaid-container");
    diagrams.forEach((container) => {
      const source = container.dataset.mermaidSource || "";
      container.innerHTML = `<div class="mermaid" data-original-content="${escapeHtmlAttribute(source)}">${source}</div>`;
    });
    await renderMermaidDiagrams();
  }

  function bindRootEvents() {
    if (!state.root) {
      return;
    }

    state.root.addEventListener("input", handleRootInput);
    state.root.addEventListener("keydown", handleRootKeyDown);
    state.root.addEventListener("change", handleRootChange);
    state.root.addEventListener("click", handleRootClick);
    state.root.addEventListener("keyup", handleRootKeyUp);
  }

  function init() {
    state.root = document.getElementById("wysiwyg-editor");
    state.container = document.getElementById("editor-container");

    if (!state.root || !state.container) {
      return;
    }

    configureMarked();
    bindRootEvents();
    bindFullscreenListeners();
    bindBlockEditListeners();

    window.addEventListener("markdown-os:theme-changed", () => {
      closeMermaidFullscreen();
      rerenderMermaidDiagramsForTheme();
    });
  }

  window.wysiwyg = {
    init,
    onChange,
    setMarkdown,
    getMarkdown,
    getHeadingElements,
    scrollHeadingIntoView,
    getScrollTop,
    setScrollTop,
    focus,
    exec: executeCommand,
    undo,
    redo,
    insertImage,
    decorateDocument,
  };
})();
