(() => {
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

  function exportToPdf() {
    const sourceElement = document.getElementById("wysiwyg-wrapper");
    if (!sourceElement) {
      return;
    }

    if (typeof window.html2pdf !== "function") {
      console.error("html2pdf is unavailable.");
      return;
    }

    const options = {
      margin: [10, 12, 10, 12],
      filename: derivePdfFilename(),
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    window
      .html2pdf()
      .set(options)
      .from(sourceElement)
      .save()
      .catch((error) => {
        console.error("Failed to export PDF.", error);
      });
  }

  window.MarkdownOS = window.MarkdownOS || {};
  window.MarkdownOS.pdfExport = { exportToPdf };
})();
