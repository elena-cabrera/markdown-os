(() => {
  const UNSUPPORTED_COLOR_PATTERN =
    /color-mix\((?:[^()]|\([^()]*\))*\)|oklab\([^)]*\)|oklch\([^)]*\)|(?:^|[^a-z-])lab\([^)]*\)|(?:^|[^a-z-])lch\([^)]*\)|color\([^)]*\)/gi;
  const PDF_EXPORT_THEME_ID = "light";
  const PDF_HIGHLIGHT_THEME = "github";
  const HIGHLIGHT_THEME_BASE = "/static/vendor/highlightjs/styles";
  const PDF_MERMAID_THEME = "default";
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

  function removeEditorChromeFromClone(clonedDocument) {
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
      clonedDocument.querySelectorAll(selector).forEach((element) => element.remove());
    });

    clonedDocument.querySelectorAll(".table-editor-wrapper").forEach((wrapper) => {
      wrapper.classList.remove("table-editor-active");
    });

    clonedDocument.querySelectorAll(".mermaid-container").forEach((container) => {
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

  function replaceMermaidSvgsWithImages(clonedDocument) {
    clonedDocument.querySelectorAll(".mermaid-canvas svg").forEach((svg) => {
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
      const image = clonedDocument.createElement("img");
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializedSvg)}`;
      image.alt = "Diagram";
      image.style.display = "block";
      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      image.style.maxWidth = "100%";
      svg.replaceWith(image);
    });
  }

  function forceLightReadableColors(clonedDocument) {
    const editor = clonedDocument.getElementById("wysiwyg-editor");
    if (!editor) {
      return;
    }

    editor.querySelectorAll("td, th, p, li, span, strong, em, a").forEach((element) => {
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

    await waitForNextPaint();

    return () => {
      replacements.forEach(({ svg, image }) => {
        image.replaceWith(svg);
      });
    };
  }

  function injectPdfExportStyles(clonedDocument) {
    const style = clonedDocument.createElement("style");
    style.id = "pdf-export-readability";
    style.textContent = `
      #wysiwyg-editor,
      #wysiwyg-editor p,
      #wysiwyg-editor li,
      #wysiwyg-editor td,
      #wysiwyg-editor th,
      #wysiwyg-editor span,
      #wysiwyg-editor strong,
      #wysiwyg-editor em,
      #wysiwyg-editor a {
        color: #111827 !important;
        -webkit-text-fill-color: #111827 !important;
      }

      #wysiwyg-editor :not(pre) > code {
        color: #111827 !important;
        background-color: #e8eaed !important;
        -webkit-text-fill-color: #111827 !important;
      }
    `;
    clonedDocument.head.appendChild(style);
  }

  function prepareClonedDocumentForPdf(clonedDocument) {
    if (!clonedDocument?.documentElement) {
      return;
    }

    clonedDocument.documentElement.setAttribute("data-theme", PDF_EXPORT_THEME_ID);
    injectPdfExportStyles(clonedDocument);
    sanitizeUnsupportedColorsInStylesheets(clonedDocument);
    removeEditorChromeFromClone(clonedDocument);
    replaceMermaidSvgsWithImages(clonedDocument);

    const highlightLink = clonedDocument.getElementById("highlight-theme");
    if (highlightLink) {
      highlightLink.setAttribute("href", `${HIGHLIGHT_THEME_BASE}/${PDF_HIGHLIGHT_THEME}.min.css`);
    }

    const wrapper = clonedDocument.getElementById("wysiwyg-wrapper");
    if (wrapper) {
      stripThemeInlineStyles(wrapper);
    }

    forceLightReadableColors(clonedDocument);

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

  async function rerenderMermaidDiagramsForPdfExport() {
    if (typeof window.wysiwyg?.rerenderMermaidDiagramsForTheme === "function") {
      await window.wysiwyg.rerenderMermaidDiagramsForTheme();
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

    const containers = document.querySelectorAll(".mermaid-container");
    for (const container of containers) {
      const source = (container.dataset.mermaidSource || "").trim();
      if (!source) {
        continue;
      }

      const canvas = container.querySelector(".mermaid-canvas");
      if (!canvas) {
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
  }

  async function prepareLightThemeForPdfExport() {
    const themeManager = window.markdownOSThemeManager;
    themeManager?.applyTheme?.(PDF_EXPORT_THEME_ID, { emitThemeEvent: false });
    await waitForNextPaint();
    await rerenderMermaidDiagramsForPdfExport();
    await waitForNextPaint();
  }

  async function restoreThemeAfterPdfExport(previousThemeId) {
    const themeManager = window.markdownOSThemeManager;
    if (!themeManager || previousThemeId === PDF_EXPORT_THEME_ID) {
      return;
    }

    themeManager.applyTheme(previousThemeId, { emitThemeEvent: false });
    await waitForNextPaint();
    await rerenderMermaidDiagramsForPdfExport();
    await waitForNextPaint();
  }

  async function withLightThemeForExport(callback) {
    const themeManager = window.markdownOSThemeManager;
    const previousThemeId = themeManager?.currentThemeId || PDF_EXPORT_THEME_ID;

    await prepareLightThemeForPdfExport();

    try {
      return await callback();
    } finally {
      await restoreThemeAfterPdfExport(previousThemeId);
    }
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

    try {
      await withLightThemeForExport(async () => {
        const restoreMermaid = await replaceMermaidWithImagesForExport(sourceElement);
        try {
          await window.html2pdf().set(options).from(sourceElement).save();
        } finally {
          restoreMermaid();
        }
      });
      setExportStatus("PDF exported", "saved");
    } catch (error) {
      console.error("Failed to export PDF.", error);
      setExportStatus("PDF export failed", "error");
    } finally {
      exportInProgress = false;
      setExportLoadingState(false);
    }
  }

  window.MarkdownOS = window.MarkdownOS || {};
  window.MarkdownOS.pdfExport = { exportToPdf };
})();
