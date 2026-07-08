(() => {
  const UNSUPPORTED_COLOR_PATTERN =
    /color-mix\((?:[^()]|\([^()]*\))*\)|oklab\([^)]*\)|oklch\([^)]*\)|(?:^|[^a-z-])lab\([^)]*\)|(?:^|[^a-z-])lch\([^)]*\)|color\([^)]*\)/gi;
  const PDF_EXPORT_THEME_ID = "light";
  const PDF_HIGHLIGHT_THEME = "github";
  const HIGHLIGHT_THEME_BASE = "/static/vendor/highlightjs/styles";
  const PDF_MERMAID_THEME = "default";
  const OFFSCREEN_EXPORT_ROOT_CLASS = "pdf-export-offscreen-root";
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
  ];

  const PDF_EXPORT_LIGHT_CSS = `
    .${OFFSCREEN_EXPORT_ROOT_CLASS} {
      color-scheme: light;
      --bg: #f7f8fa;
      --panel-bg: #ffffff;
      --border: #d9dee7;
      --text: #17233b;
      --text-muted: #60708f;
      --accent: #2563eb;
      --accent-soft: #dbeafe;
      --editor-bg: #ffffff;
      --editor-text: #111827;
      --preview-text: #1f2937;
      --code-block-bg: #f8fafc;
      --inline-code-bg: #e8eaed;
      --code-header-bg: #f3f7ff;
      --mermaid-bg: #ffffff;
      --frontmatter-bg: #f8fafc;
      --frontmatter-border: #dbe2ee;
      --frontmatter-key: #5b6c8d;
      --frontmatter-chip-bg: #e9eef8;
      --frontmatter-chip-text: #1f2c47;
      --table-border: #d9dee7;
      --table-header-bg: #f0f4fa;
      --table-header-text: #17233b;
      --table-row-alt-bg: #f7f8fa;
      --table-row-hover-bg: #eef2f9;
      background: #ffffff;
      color: #111827;
    }

    .${OFFSCREEN_EXPORT_ROOT_CLASS} #wysiwyg-wrapper {
      background: #ffffff !important;
      color: #111827 !important;
    }

    .${OFFSCREEN_EXPORT_ROOT_CLASS} #wysiwyg-editor {
      background: transparent !important;
      color: #111827 !important;
    }

    .${OFFSCREEN_EXPORT_ROOT_CLASS} #wysiwyg-editor
      :is(h1, h2, h3, h4, h5, h6, p, li, td, th, span, strong, em, a, blockquote) {
      color: #111827 !important;
      -webkit-text-fill-color: #111827 !important;
    }

    .${OFFSCREEN_EXPORT_ROOT_CLASS} #wysiwyg-editor :not(pre) > code {
      color: #111827 !important;
      background-color: #e8eaed !important;
      -webkit-text-fill-color: #111827 !important;
    }
  `;

  let exportInProgress = false;

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
      ".frontmatter-add-property",
      ".frontmatter-edit-property",
      ".frontmatter-delete-property",
      ".frontmatter-property-actions",
    ];

    selectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach((element) => element.remove());
    });

    root.querySelectorAll(".table-editor-wrapper").forEach((wrapper) => {
      wrapper.classList.remove("table-editor-active");
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
    style.textContent = PDF_EXPORT_LIGHT_CSS.replaceAll(
      `.${OFFSCREEN_EXPORT_ROOT_CLASS}`,
      "",
    );
    clonedDocument.head.appendChild(style);
  }

  function prepareClonedDocumentForPdf(clonedDocument) {
    if (!clonedDocument?.documentElement) {
      return;
    }

    clonedDocument.documentElement.setAttribute("data-theme", PDF_EXPORT_THEME_ID);
    injectPdfExportStyles(clonedDocument);
    sanitizeUnsupportedColorsInStylesheets(clonedDocument);

    const clonedRoot =
      clonedDocument.getElementById("wysiwyg-wrapper") || clonedDocument.body;
    removeEditorChromeFromRoot(clonedRoot);
    replaceMermaidSvgsWithImages(clonedRoot);

    const highlightLink = clonedDocument.getElementById("highlight-theme");
    if (highlightLink) {
      highlightLink.setAttribute("href", `${HIGHLIGHT_THEME_BASE}/${PDF_HIGHLIGHT_THEME}.min.css`);
    }

    const wrapper = clonedDocument.getElementById("wysiwyg-wrapper");
    if (wrapper) {
      stripThemeInlineStyles(wrapper);
    }

    forceLightReadableColors(clonedRoot);

    const editor = clonedDocument.getElementById("wysiwyg-editor");
    if (editor) {
      editor.removeAttribute("contenteditable");
      editor.style.paddingBottom = "20px";
    }
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
    const host = document.createElement("div");
    host.className = OFFSCREEN_EXPORT_ROOT_CLASS;
    host.setAttribute("data-theme", PDF_EXPORT_THEME_ID);
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;left:-100000px;top:0;width:900px;pointer-events:none;visibility:hidden;";

    const clone = sourceElement.cloneNode(true);
    host.appendChild(clone);
    document.body.appendChild(host);

    stripThemeInlineStyles(clone);
    removeEditorChromeFromRoot(clone);
    await prepareMermaidInExportRoot(host);
    await replaceMermaidWithImagesForExport(clone);
    await waitForNextPaint();

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
    };

    let offscreenHost = null;

    try {
      offscreenHost = await createOffscreenExportRoot(sourceElement);
      const exportTarget = offscreenHost.querySelector("#wysiwyg-wrapper");
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
      restoreMermaidGlobalConfig();
      exportInProgress = false;
      setExportLoadingState(false);
    }
  }

  window.MarkdownOS = window.MarkdownOS || {};
  window.MarkdownOS.pdfExport = { exportToPdf };
})();
