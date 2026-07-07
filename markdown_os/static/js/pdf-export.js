(() => {
  const UNSUPPORTED_COLOR_PATTERN =
    /color-mix\((?:[^()]|\([^()]*\))*\)|oklab\([^)]*\)|oklch\([^)]*\)|(?:^|[^a-z-])lab\([^)]*\)|(?:^|[^a-z-])lch\([^)]*\)|color\([^)]*\)/gi;
  const PDF_EXPORT_THEME_ID = "light";
  const PDF_HIGHLIGHT_THEME = "github";
  const PDF_MERMAID_THEME = "default";
  const HIGHLIGHT_THEME_BASE = "/static/vendor/highlightjs/styles";
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
  const PDF_LIGHT_THEME_CSS = `
    :root,
    html,
    body {
      color-scheme: light !important;
      --bg: #f7f8fa;
      --panel-bg: #ffffff;
      --border: #d9dee7;
      --text: #17233b;
      --text-muted: #60708f;
      --accent: #2563eb;
      --accent-soft: #dbeafe;
      --success: #0f766e;
      --danger: #b91c1c;
      --warning: #9a6700;
      --shadow: 0 6px 20px rgba(17, 24, 39, 0.08);
      --editor-bg: #ffffff;
      --editor-text: #111827;
      --preview-text: #1f2937;
      --code-block-bg: #f8fafc;
      --inline-code-bg: #e8eaed;
      --code-header-bg: #f3f7ff;
      --copy-border: #bec9dd;
      --copy-bg: #ffffff;
      --copy-text: #334155;
      --code-line-number-bg: #eef2ff;
      --code-line-number-text: #64748b;
      --mermaid-bg: #ffffff;
      --mermaid-error-border: #fecaca;
      --mermaid-error-bg: #fef2f2;
      --mermaid-error-text: #991b1b;
      --math-display-bg: #fafcff;
      --math-display-border: #dbeafe;
      --math-error-text: #991b1b;
      --math-error-bg: #fef2f2;
      --math-error-border: #fecaca;
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
    }

    html,
    body,
    #wysiwyg-wrapper,
    #wysiwyg-editor {
      background: #ffffff !important;
      color: #111827 !important;
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

  function injectLightThemeStyles(clonedDocument) {
    if (!clonedDocument?.head) {
      return;
    }

    const existingStyle = clonedDocument.getElementById("pdf-export-light-theme");
    existingStyle?.remove();

    const style = clonedDocument.createElement("style");
    style.id = "pdf-export-light-theme";
    style.textContent = PDF_LIGHT_THEME_CSS;
    clonedDocument.head.appendChild(style);
  }

  function swapHighlightThemeInDocument(clonedDocument, highlightThemeId) {
    const highlightLink = clonedDocument.getElementById("highlight-theme");
    if (!highlightLink) {
      return;
    }

    highlightLink.setAttribute("href", `${HIGHLIGHT_THEME_BASE}/${highlightThemeId}.min.css`);
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

  function applyMermaidSnapshots(clonedDocument, mermaidSnapshots) {
    if (!mermaidSnapshots?.length) {
      return;
    }

    const containers = clonedDocument.querySelectorAll(".mermaid-container");
    containers.forEach((container, index) => {
      const snapshot = mermaidSnapshots[index];
      if (!snapshot) {
        return;
      }

      const canvas = container.querySelector(".mermaid-canvas");
      if (!canvas) {
        return;
      }

      const template = clonedDocument.createElement("template");
      template.innerHTML = snapshot.trim();
      canvas.replaceChildren(...template.content.childNodes);
    });
  }

  function prepareClonedDocumentForPdf(clonedDocument, mermaidSnapshots) {
    if (!clonedDocument?.documentElement) {
      return;
    }

    clonedDocument.documentElement.setAttribute("data-theme", PDF_EXPORT_THEME_ID);
    injectLightThemeStyles(clonedDocument);
    swapHighlightThemeInDocument(clonedDocument, PDF_HIGHLIGHT_THEME);
    sanitizeUnsupportedColorsInStylesheets(clonedDocument);
    removeEditorChromeFromClone(clonedDocument);
    applyMermaidSnapshots(clonedDocument, mermaidSnapshots);

    const wrapper = clonedDocument.getElementById("wysiwyg-wrapper");
    if (wrapper) {
      stripThemeInlineStyles(wrapper);
      wrapper.style.background = "#ffffff";
      wrapper.style.color = "#111827";
    }

    const editor = clonedDocument.getElementById("wysiwyg-editor");
    if (editor) {
      stripThemeInlineStyles(editor);
      editor.removeAttribute("contenteditable");
      editor.style.paddingBottom = "20px";
      editor.style.background = "transparent";
      editor.style.color = "#111827";
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

  function getMermaidContainers(sourceElement) {
    return Array.from(sourceElement.querySelectorAll(".mermaid-container"));
  }

  function readMermaidSource(container) {
    return container.dataset.mermaidSource || "";
  }

  async function renderLightMermaidSnapshots(sourceElement) {
    if (!window.mermaid) {
      return [];
    }

    const containers = getMermaidContainers(sourceElement);
    if (containers.length === 0) {
      return [];
    }

    const previousMermaidConfig = window.mermaid.mermaidAPI?.getConfig?.() || null;
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: PDF_MERMAID_THEME,
      useMaxWidth: false,
    });

    const snapshots = [];
    for (const container of containers) {
      const source = readMermaidSource(container).trim();
      if (!source) {
        snapshots.push("");
        continue;
      }

      const renderId = `pdf-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const { svg } = await window.mermaid.render(renderId, source);
        snapshots.push(svg);
      } catch (error) {
        console.error("Failed to render Mermaid diagram for PDF export.", error);
        const canvas = container.querySelector(".mermaid-canvas");
        snapshots.push(canvas?.innerHTML || "");
      }
    }

    if (previousMermaidConfig) {
      window.mermaid.initialize(previousMermaidConfig);
    } else {
      const currentThemeId = window.markdownOSThemeManager?.currentThemeId || PDF_EXPORT_THEME_ID;
      const mermaidThemeByAppTheme = {
        light: "default",
        dark: "dark",
        dracula: "dark",
        "nord-light": "neutral",
        "nord-dark": "dark",
        lofi: "neutral",
      };
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: mermaidThemeByAppTheme[currentThemeId] || "default",
        useMaxWidth: false,
      });
    }

    return snapshots;
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

    let mermaidSnapshots = [];
    try {
      mermaidSnapshots = await renderLightMermaidSnapshots(sourceElement);
    } catch (error) {
      console.error("Failed to prepare Mermaid diagrams for PDF export.", error);
    }

    const options = {
      margin: [10, 12, 10, 12],
      filename: derivePdfFilename(),
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        onclone: (clonedDocument) => {
          prepareClonedDocumentForPdf(clonedDocument, mermaidSnapshots);
        },
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    try {
      await window.html2pdf().set(options).from(sourceElement).save();
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
