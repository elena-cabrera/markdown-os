(() => {
  const UNSUPPORTED_COLOR_PATTERN =
    /color-mix\((?:[^()]|\([^()]*\))*\)|oklab\([^)]*\)|oklch\([^)]*\)|(?:^|[^a-z-])lab\([^)]*\)|(?:^|[^a-z-])lch\([^)]*\)|color\([^)]*\)/gi;
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
    ];

    selectors.forEach((selector) => {
      clonedDocument.querySelectorAll(selector).forEach((element) => element.remove());
    });

    clonedDocument.querySelectorAll(".table-editor-wrapper").forEach((wrapper) => {
      wrapper.classList.remove("table-editor-active");
    });
  }

  function prepareClonedDocumentForPdf(clonedDocument) {
    if (!clonedDocument?.documentElement) {
      return;
    }

    clonedDocument.documentElement.setAttribute("data-theme", "light");
    sanitizeUnsupportedColorsInStylesheets(clonedDocument);
    removeEditorChromeFromClone(clonedDocument);

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

  function exportToPdf() {
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

    window
      .html2pdf()
      .set(options)
      .from(sourceElement)
      .save()
      .then(() => {
        setExportStatus("PDF exported", "saved");
      })
      .catch((error) => {
        console.error("Failed to export PDF.", error);
        setExportStatus("PDF export failed", "error");
      })
      .finally(() => {
        exportInProgress = false;
        setExportLoadingState(false);
      });
  }

  window.MarkdownOS = window.MarkdownOS || {};
  window.MarkdownOS.pdfExport = { exportToPdf };
})();
