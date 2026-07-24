(() => {
  const UNSUPPORTED_COLOR_PATTERN =
    /color-mix\((?:[^()]|\([^()]*\))*\)|oklab\([^)]*\)|oklch\([^)]*\)|(?:^|[^a-z-])lab\([^)]*\)|(?:^|[^a-z-])lch\([^)]*\)|color\([^)]*\)/gi;
  const PDF_EXPORT_THEME_ID = "light";
  const PDF_HIGHLIGHT_THEME = "github";
  const HIGHLIGHT_THEME_BASE = "/static/vendor/highlightjs/styles";
  const PDF_MERMAID_THEME = "default";
  const OFFSCREEN_EXPORT_ROOT_CLASS = "pdf-export-offscreen-root";
  // A4 inner width with 12mm side margins: (210 - 24)mm at 96dpi. html2pdf
  // re-flows the captured clone into a container of exactly this width, so
  // preparing the off-screen layout at the same width keeps Mermaid sizing
  // and line wrapping identical to the final capture.
  const EXPORT_CONTENT_WIDTH_PX = Math.round(((210 - 24) * 96) / 25.4);
  const MERMAID_THEME_BY_APP_THEME = {
    light: "default",
    dark: "dark",
    dracula: "dark",
    "nord-light": "neutral",
    "nord-dark": "dark",
    lofi: "neutral",
  };
  const INLINE_STYLE_PROPERTIES_TO_STRIP = [
    "color",
    "background",
    "background-color",
    "background-image",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "fill",
    "stroke",
    // Decorative-only in print; their colors can serialize to color
    // functions (oklab/oklch/color) that html2canvas cannot parse.
    "box-shadow",
    "text-shadow",
    "outline",
    "outline-color",
    "text-decoration-color",
    "caret-color",
  ];
  // Editor interaction-state classes whose rules use color-mix() outlines
  // and backgrounds; harmless in the editor, fatal for html2canvas.
  const EDITOR_STATE_CLASSES = [
    "table-editor-active",
    "table-row-highlight",
    "table-col-highlight",
    "table-row-delete-preview",
    "table-col-delete-preview",
    "table-delete-preview",
    "table-delete-selected",
    "table-editor-delete-selected",
    "drag-over",
  ];

  const PDF_LIGHT_THEME_VARIABLES = {
    "--bg": "#f7f8fa",
    "--panel-bg": "#ffffff",
    "--border": "#d9dee7",
    "--text": "#17233b",
    "--text-muted": "#60708f",
    "--accent": "#2563eb",
    "--accent-soft": "#dbeafe",
    "--success": "#0f766e",
    "--danger": "#b91c1c",
    "--warning": "#9a6700",
    "--shadow": "0 6px 20px rgba(17, 24, 39, 0.08)",
    "--editor-bg": "#ffffff",
    "--editor-text": "#111827",
    "--preview-text": "#1f2937",
    "--code-block-bg": "#f8fafc",
    "--inline-code-bg": "#e8eaed",
    "--code-header-bg": "#f3f7ff",
    "--copy-border": "#bec9dd",
    "--copy-border-hover": "#9fb0cc",
    "--copy-bg": "#ffffff",
    "--copy-text": "#334155",
    "--copy-text-hover": "#0f172a",
    "--copy-copied-border": "#8ed4ce",
    "--code-line-number-bg": "#eef2ff",
    "--code-line-number-text": "#64748b",
    "--mermaid-bg": "#ffffff",
    // Taller cap than the editor default (420px) so diagrams render at a
    // readable size, but below one A4 content page (~1047px) so the
    // page-break "avoid" rule can keep each diagram on a single page.
    "--mermaid-max-height": "980px",
    "--mermaid-error-border": "#fecaca",
    "--mermaid-error-bg": "#fef2f2",
    "--mermaid-error-text": "#991b1b",
    "--math-display-bg": "#fafcff",
    "--math-display-border": "#dbeafe",
    "--math-error-text": "#991b1b",
    "--math-error-bg": "#fef2f2",
    "--math-error-border": "#fecaca",
    "--frontmatter-bg": "#f8fafc",
    "--frontmatter-border": "#dbe2ee",
    "--frontmatter-key": "#5b6c8d",
    "--frontmatter-chip-bg": "#e9eef8",
    "--frontmatter-chip-text": "#1f2c47",
    "--table-border": "#d9dee7",
    "--table-header-bg": "#f0f4fa",
    "--table-header-text": "#17233b",
    "--table-row-alt-bg": "#f7f8fa",
    "--table-row-hover-bg": "#eef2f9",
    "--drag-over-bg": "#f0f7ff",
  };

  const PDF_EXPORT_LIGHT_CSS = `
    [data-pdf-export-root] {
      color-scheme: light;
      background: #ffffff !important;
      color: #111827 !important;
    }

    [data-pdf-export-root] #wysiwyg-editor {
      background: transparent !important;
      color: #111827 !important;
    }

    [data-pdf-export-root] #wysiwyg-editor
      :is(h1, h2, h3, h4, h5, h6, p, li, td, th, span, strong, em, a, blockquote) {
      color: #111827 !important;
      -webkit-text-fill-color: #111827 !important;
    }

    [data-pdf-export-root] #wysiwyg-editor :not(pre) > code {
      color: #111827 !important;
      background-color: #e8eaed !important;
      -webkit-text-fill-color: #111827 !important;
      white-space: pre-wrap !important;
    }

    /* Print never needs focus rings or shadows, and their colors are the
       main carriers of color-mix()/oklab() values html2canvas rejects. */
    [data-pdf-export-root] *,
    [data-pdf-export-root] *::before,
    [data-pdf-export-root] *::after {
      outline: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }

    /* --- No-crop layout overrides ------------------------------------- */
    /* Tables scroll horizontally in the editor; a PDF page cannot scroll,
       so lay them out as real tables and let cell content wrap instead. */
    [data-pdf-export-root] #wysiwyg-editor table {
      display: table !important;
      width: 100% !important;
      overflow-x: visible !important;
      table-layout: auto !important;
    }

    /* Header cells keep whole words; body cells may break long words. The
       zero-width spaces injected into code spans provide the preferred break
       points, which html2canvas renders correctly (forced mid-token breaks
       draw overlapping glyphs). */
    [data-pdf-export-root] #wysiwyg-editor th {
      white-space: normal !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
    }

    [data-pdf-export-root] #wysiwyg-editor th,
    [data-pdf-export-root] #wysiwyg-editor td {
      overflow-wrap: break-word;
      height: auto !important;
      min-height: 0 !important;
      min-width: 0 !important;
    }

    [data-pdf-export-root] .table-editor-wrapper {
      padding: 0 !important;
      overflow: visible !important;
    }

    /* Code blocks scroll in the editor; wrap long lines in the PDF. */
    [data-pdf-export-root] .code-block-content {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    [data-pdf-export-root] .code-line-numbers {
      display: none !important;
    }

    [data-pdf-export-root] .code-block-content pre {
      overflow: visible !important;
    }

    [data-pdf-export-root] .code-block-content pre code {
      white-space: pre-wrap !important;
      word-break: break-word !important;
      min-width: 0 !important;
    }

    [data-pdf-export-root] .mermaid-canvas {
      max-height: none !important;
      overflow: visible !important;
    }

    /* Keep indivisible blocks on one page where possible. */
    [data-pdf-export-root] #wysiwyg-editor tr,
    [data-pdf-export-root] .mermaid-container,
    [data-pdf-export-root] .math-display,
    [data-pdf-export-root] #wysiwyg-editor img,
    [data-pdf-export-root] #wysiwyg-editor blockquote {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  `;

  let exportInProgress = false;
  let liveExportStyle = null;

  function installLiveExportStyles() {
    removeLiveExportStyles();
    liveExportStyle = document.createElement("style");
    liveExportStyle.id = "pdf-export-live-styles";
    liveExportStyle.textContent = PDF_EXPORT_LIGHT_CSS;
    document.head.appendChild(liveExportStyle);
  }

  function removeLiveExportStyles() {
    liveExportStyle?.remove();
    liveExportStyle = null;
  }

  function toRgbColor(colorValue) {
    if (!colorValue || colorValue === "transparent") {
      return "transparent";
    }

    if (colorValue === "inherit" || colorValue === "initial" || colorValue === "unset") {
      return colorValue;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) {
      return "transparent";
    }

    try {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = colorValue;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      if (alpha === 255) {
        return `rgb(${red}, ${green}, ${blue})`;
      }

      return `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(3)})`;
    } catch (_error) {
      return "transparent";
    }
  }

  function resolveColorExpression(expression) {
    const probe = document.createElement("div");
    probe.style.display = "none";
    document.body.appendChild(probe);

    try {
      probe.style.color = expression;
      const computed = window.getComputedStyle(probe).color;
      return toRgbColor(computed);
    } catch (_error) {
      return "transparent";
    } finally {
      probe.remove();
    }
  }

  function sanitizeCssText(cssText) {
    return cssText.replace(UNSUPPORTED_COLOR_PATTERN, (match) => resolveColorExpression(match));
  }

  function cssTextNeedsColorSanitization(cssText) {
    if (!cssText) {
      return false;
    }

    return /color-mix|oklab|oklch|\blab\(|\blch\(|\bcolor\(/i.test(cssText);
  }

  function sanitizeUnsupportedColorsInStylesheets(clonedDocument) {
    Array.from(clonedDocument.styleSheets).forEach((sheet) => {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (_error) {
        return;
      }

      for (let index = rules.length - 1; index >= 0; index -= 1) {
        const rule = rules[index];
        const cssText = rule.cssText;
        if (!cssTextNeedsColorSanitization(cssText)) {
          continue;
        }

        try {
          const sanitized = sanitizeCssText(cssText);
          sheet.deleteRule(index);
          sheet.insertRule(sanitized, index);
        } catch (_error) {
          try {
            sheet.deleteRule(index);
          } catch (_deleteError) {
            // Ignore rules that cannot be rewritten.
          }
        }
      }
    });
  }

  function sanitizeInlineStylesInSubtree(root) {
    if (!(root instanceof Element)) {
      return;
    }

    const elements = [root, ...root.querySelectorAll("[style]")];
    elements.forEach((element) => {
      const cssText = element.getAttribute("style");
      if (!cssTextNeedsColorSanitization(cssText)) {
        return;
      }

      element.setAttribute("style", sanitizeCssText(cssText));
    });
  }

  function removeEditorChromeFromRoot(root) {
    const selectors = [
      ".table-edge-layer",
      ".table-insert-preview-layer",
      ".table-control-button",
      ".table-row-insert-handle",
      ".table-col-insert-handle",
      ".table-row-delete-handle",
      ".table-col-delete-handle",
      ".mermaid-inline-toolbar",
      ".mermaid-zoom-controls",
      ".mermaid-fullscreen-trigger",
      ".block-edit-trigger",
      ".copy-button",
      ".code-block-actions",
      ".frontmatter-properties-create",
      ".frontmatter-add-property",
      ".frontmatter-edit-property",
      ".frontmatter-delete-property",
      ".frontmatter-property-actions",
    ];

    selectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach((element) => element.remove());
    });

    EDITOR_STATE_CLASSES.forEach((className) => {
      root.querySelectorAll(`.${className}`).forEach((element) => {
        element.classList.remove(className);
      });
    });

    root.querySelectorAll(".mermaid-container").forEach((container) => {
      const canvas = container.querySelector(".mermaid-canvas");
      if (!canvas) {
        return;
      }

      canvas.style.maxHeight = "none";
      canvas.style.overflow = "visible";
    });
  }

  function insertCodeBreakOpportunities(root) {
    // html2canvas draws overlapping glyphs when the browser is forced to
    // wrap monospace text mid-token. Zero-width spaces after punctuation
    // give the layout engine clean break points instead.
    const BREAKABLE_PUNCTUATION = /([/_\-.,:;{}()[\]@?&=+#])/g;

    root.querySelectorAll("code").forEach((code) => {
      const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      textNodes.forEach((textNode) => {
        const text = textNode.nodeValue || "";
        if (!BREAKABLE_PUNCTUATION.test(text)) {
          return;
        }

        BREAKABLE_PUNCTUATION.lastIndex = 0;
        textNode.nodeValue = text.replace(BREAKABLE_PUNCTUATION, "$1\u200b");
      });
    });
  }

  function stripThemeInlineStyles(root) {
    if (!(root instanceof Element)) {
      return;
    }

    const elements = [root, ...root.querySelectorAll("[style]")];
    elements.forEach((element) => {
      INLINE_STYLE_PROPERTIES_TO_STRIP.forEach((property) => {
        element.style.removeProperty(property);
      });

      if (!element.getAttribute("style")?.trim()) {
        element.removeAttribute("style");
      }
    });
  }

  function replaceMermaidSvgsWithImages(root) {
    root.querySelectorAll(".mermaid-canvas svg").forEach((svg) => {
      if (!(svg instanceof SVGSVGElement)) {
        return;
      }

      const bounds = svg.getBoundingClientRect();
      const viewBox = svg.viewBox?.baseVal;
      const width =
        bounds.width ||
        viewBox?.width ||
        Number.parseFloat(svg.getAttribute("width") || "") ||
        320;
      const height =
        bounds.height ||
        viewBox?.height ||
        Number.parseFloat(svg.getAttribute("height") || "") ||
        240;

      const serializedSvg = new XMLSerializer().serializeToString(svg);
      const image = document.createElement("img");
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializedSvg)}`;
      image.alt = "Diagram";
      image.style.display = "block";
      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      image.style.maxWidth = "100%";
      svg.replaceWith(image);
    });
  }

  function forceLightReadableColors(root) {
    const editor = root.querySelector("#wysiwyg-editor");
    if (!editor) {
      return;
    }

    editor
      .querySelectorAll("h1, h2, h3, h4, h5, h6, td, th, p, li, span, strong, em, a, blockquote")
      .forEach((element) => {
        if (element.closest("pre, .code-block, .mermaid-container")) {
          return;
        }

        element.style.setProperty("color", "#111827", "important");
        element.style.setProperty("-webkit-text-fill-color", "#111827", "important");
      });

    editor.querySelectorAll("code").forEach((code) => {
      if (code.closest("pre, .code-block")) {
        return;
      }

      code.style.setProperty("color", "#111827", "important");
      code.style.setProperty("-webkit-text-fill-color", "#111827", "important");
      code.style.setProperty("background-color", "#e8eaed", "important");
    });
  }

  async function svgElementToImageMarkup(svg) {
    const serializedSvg = new XMLSerializer().serializeToString(svg);
    const viewBox = svg.viewBox?.baseVal;
    const bounds = svg.getBoundingClientRect();
    const width = Math.ceil(bounds.width || viewBox?.width || 320);
    const height = Math.ceil(bounds.height || viewBox?.height || 240);
    const image = document.createElement("img");
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializedSvg)}`;
    image.alt = "Diagram";
    image.className = "pdf-export-mermaid-image";
    image.style.display = "block";
    image.style.maxWidth = "100%";
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;

    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", () => reject(new Error("Failed to load Mermaid image.")), {
        once: true,
      });
    });

    return image;
  }

  async function replaceMermaidWithImagesForExport(root) {
    const replacements = [];

    for (const container of root.querySelectorAll(".mermaid-container")) {
      const canvas = container.querySelector(".mermaid-canvas");
      const svg = canvas?.querySelector("svg");
      if (!(svg instanceof SVGSVGElement)) {
        continue;
      }

      const image = await svgElementToImageMarkup(svg);
      replacements.push({ svg, image });
      svg.replaceWith(image);
    }

    return () => {
      replacements.forEach(({ svg, image }) => {
        image.replaceWith(svg);
      });
    };
  }

  function injectPdfExportStyles(clonedDocument) {
    const style = clonedDocument.createElement("style");
    style.id = "pdf-export-readability";
    style.textContent = PDF_EXPORT_LIGHT_CSS;
    clonedDocument.head.appendChild(style);
  }

  function prepareClonedDocumentForPdf(clonedDocument) {
    if (!clonedDocument?.documentElement) {
      return;
    }

    clonedDocument.documentElement.setAttribute("data-theme", PDF_EXPORT_THEME_ID);
    injectPdfExportStyles(clonedDocument);
    sanitizeUnsupportedColorsInStylesheets(clonedDocument);

    const highlightLink = clonedDocument.getElementById("highlight-theme");
    if (highlightLink) {
      highlightLink.setAttribute("href", `${HIGHLIGHT_THEME_BASE}/${PDF_HIGHLIGHT_THEME}.min.css`);
    }

    clonedDocument.querySelectorAll("[data-pdf-export-root] #wysiwyg-editor").forEach((editor) => {
      editor.removeAttribute("contenteditable");
      editor.style.paddingBottom = "20px";
    });
  }

  function derivePdfFilename() {
    const rawTitle = (document.title || "").trim();
    const normalizedTitle = rawTitle.replace(/\.md$/i, "").trim();
    if (!normalizedTitle || normalizedTitle === "Markdown-OS") {
      return "document-export.pdf";
    }

    const sanitizedTitle = normalizedTitle
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

    if (!sanitizedTitle) {
      return "document-export.pdf";
    }

    return `${sanitizedTitle}.pdf`;
  }

  function setExportStatus(message, variant = "neutral") {
    window.sharedUtils?.setSaveStatus?.(message, variant);
  }

  function setExportLoadingState(isLoading) {
    window.sharedUtils?.setContentLoadingState?.(isLoading);
  }

  function waitForNextPaint() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve);
      });
    });
  }

  function currentAppMermaidTheme() {
    const appThemeId = document.documentElement.getAttribute("data-theme") || PDF_EXPORT_THEME_ID;
    return MERMAID_THEME_BY_APP_THEME[appThemeId] || PDF_MERMAID_THEME;
  }

  function restoreMermaidGlobalConfig() {
    if (!window.mermaid) {
      return;
    }

    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: currentAppMermaidTheme(),
      fontFamily: "Inter, sans-serif",
      useMaxWidth: false,
    });
  }

  async function prepareMermaidInExportRoot(exportRoot) {
    const containers = Array.from(exportRoot.querySelectorAll(".mermaid-container"));
    if (containers.length === 0) {
      return;
    }

    if (typeof window.wysiwyg?.renderMermaidContainers === "function") {
      await window.wysiwyg.renderMermaidContainers(containers, {
        theme: PDF_MERMAID_THEME,
      });
      restoreMermaidGlobalConfig();
      return;
    }

    if (!window.mermaid) {
      return;
    }

    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: PDF_MERMAID_THEME,
      fontFamily: "Inter, sans-serif",
      useMaxWidth: false,
    });

    for (const container of containers) {
      const source = (container.dataset.mermaidSource || "").trim();
      const canvas = container.querySelector(".mermaid-canvas");
      if (!source || !canvas) {
        continue;
      }

      canvas.replaceChildren();
      const renderId = `pdf-export-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const { svg } = await window.mermaid.render(renderId, source);
        const template = document.createElement("template");
        template.innerHTML = svg.trim();
        canvas.replaceChildren(...template.content.childNodes);
      } catch (error) {
        console.error("Failed to render Mermaid diagram for PDF export.", error);
      }
    }

    restoreMermaidGlobalConfig();
  }

  async function createOffscreenExportRoot(sourceElement) {
    installLiveExportStyles();

    const host = document.createElement("div");
    host.className = OFFSCREEN_EXPORT_ROOT_CLASS;
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = `position:absolute;left:-100000px;top:0;width:${EXPORT_CONTENT_WIDTH_PX}px;pointer-events:none;`;

    const clone = sourceElement.cloneNode(true);
    host.appendChild(clone);
    document.body.appendChild(host);

    stripThemeInlineStyles(clone);
    sanitizeInlineStylesInSubtree(clone);

    // The attribute and inline variables live on the export target itself so
    // they survive html2pdf's internal cloning of the captured subtree.
    clone.setAttribute("data-pdf-export-root", "true");
    Object.entries(PDF_LIGHT_THEME_VARIABLES).forEach(([variableName, value]) => {
      clone.style.setProperty(variableName, value);
    });

    insertCodeBreakOpportunities(clone);
    await prepareMermaidInExportRoot(host);
    // Chrome removal runs after the Mermaid re-render because rendering
    // re-attaches inline toolbars and zoom controls to each container.
    removeEditorChromeFromRoot(clone);
    await replaceMermaidWithImagesForExport(clone);
    forceLightReadableColors(host);
    await waitForNextPaint();

    // Safety net: if something still overflows 900px (e.g. an unbreakable
    // token), widen the host so html2pdf scales content down instead of
    // cropping it at the page edge.
    const overflowWidth = Math.max(clone.scrollWidth, clone.offsetWidth);
    if (overflowWidth > host.offsetWidth) {
      host.style.width = `${overflowWidth}px`;
      await waitForNextPaint();
    }

    return host;
  }

  async function exportToPdf() {
    if (exportInProgress) {
      return;
    }

    const sourceElement = document.getElementById("wysiwyg-wrapper");
    if (!sourceElement) {
      return;
    }

    if (typeof window.html2pdf !== "function") {
      console.error("html2pdf is unavailable.");
      setExportStatus("PDF export unavailable", "error");
      return;
    }

    exportInProgress = true;
    setExportLoadingState(true);
    setExportStatus("Exporting PDF...", "saving");

    const options = {
      margin: [10, 12, 10, 12],
      filename: derivePdfFilename(),
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        onclone: prepareClonedDocumentForPdf,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: [
          "tr",
          ".mermaid-container",
          ".math-display",
          "img",
          "blockquote",
          "h1",
          "h2",
          "h3",
          "h4",
        ],
      },
    };

    let offscreenHost = null;

    try {
      offscreenHost = await createOffscreenExportRoot(sourceElement);
      const exportTarget = offscreenHost.querySelector("[data-pdf-export-root]");
      if (!exportTarget) {
        throw new Error("Failed to prepare off-screen PDF export content.");
      }

      await window.html2pdf().set(options).from(exportTarget).save();
      setExportStatus("PDF exported", "saved");
    } catch (error) {
      console.error("Failed to export PDF.", error);
      setExportStatus("PDF export failed", "error");
    } finally {
      offscreenHost?.remove();
      removeLiveExportStyles();
      restoreMermaidGlobalConfig();
      exportInProgress = false;
      setExportLoadingState(false);
    }
  }

  window.MarkdownOS = window.MarkdownOS || {};
  window.MarkdownOS.pdfExport = { exportToPdf };
})();
