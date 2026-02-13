(() => {
  const panZoomKey = "data-panzoom-initialized";

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

  function addCodeBlockDecorations() {
    const preview = document.getElementById("markdown-preview");
    if (!preview) {
      return;
    }

    const codeBlocks = preview.querySelectorAll("pre > code");
    codeBlocks.forEach((codeElement) => {
      const preElement = codeElement.parentElement;
      if (!preElement || preElement.dataset.decorated === "true") {
        return;
      }

      preElement.dataset.decorated = "true";

      const languageLabel = inferLanguageLabel(codeElement);
      const wrapper = document.createElement("div");
      wrapper.className = "code-block";

      const header = document.createElement("div");
      header.className = "code-block-header";

      const label = document.createElement("span");
      label.className = "code-language-label";
      label.textContent = languageLabel;

      const copyButton = document.createElement("button");
      copyButton.className = "copy-button";
      copyButton.type = "button";
      copyButton.textContent = "Copy";
      copyButton.addEventListener("click", async () => {
        try {
          await copyToClipboard(codeElement.textContent || "");
          copyButton.textContent = "Copied";
          copyButton.classList.add("copied");
          window.setTimeout(() => {
            copyButton.textContent = "Copy";
            copyButton.classList.remove("copied");
          }, 1200);
        } catch (error) {
          console.error("Failed to copy code content.", error);
          copyButton.textContent = "Copy failed";
          window.setTimeout(() => {
            copyButton.textContent = "Copy";
          }, 1200);
        }
      });

      header.appendChild(label);
      header.appendChild(copyButton);
      preElement.replaceWith(wrapper);
      wrapper.appendChild(header);
      wrapper.appendChild(preElement);

      if (
        window.hljs &&
        languageLabel !== "mermaid" &&
        !codeElement.classList.contains("hljs")
      ) {
        window.hljs.highlightElement(codeElement);
      }
    });
  }

  function ensureMermaidInitialized() {
    if (!window.mermaid || ensureMermaidInitialized.initialized) {
      return;
    }

    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "default",
    });
    ensureMermaidInitialized.initialized = true;
  }
  ensureMermaidInitialized.initialized = false;

  async function renderMermaidDiagrams() {
    if (!window.mermaid) {
      return;
    }

    ensureMermaidInitialized();
    const preview = document.getElementById("markdown-preview");
    if (!preview) {
      return;
    }

    const mermaidBlocks = preview.querySelectorAll(
      "pre > code.language-mermaid, pre > code.lang-mermaid",
    );

    mermaidBlocks.forEach((codeElement) => {
      const preElement = codeElement.parentElement;
      if (!preElement) {
        return;
      }

      const mermaidContainer = document.createElement("div");
      mermaidContainer.className = "mermaid-container";

      const mermaidElement = document.createElement("div");
      mermaidElement.className = "mermaid";
      mermaidElement.textContent = codeElement.textContent || "";

      mermaidContainer.appendChild(mermaidElement);
      preElement.replaceWith(mermaidContainer);
    });

    try {
      await window.mermaid.run({
        querySelector: ".mermaid-container .mermaid",
      });
    } catch (error) {
      console.error("Mermaid rendering error.", error);
      preview
        .querySelectorAll(".mermaid-container .mermaid")
        .forEach((mermaidElement) => {
          const container = mermaidElement.parentElement;
          if (!container) {
            return;
          }
          container.innerHTML = `<div class="mermaid-error">Invalid mermaid syntax:\n${mermaidElement.textContent || ""}</div>`;
        });
    }
  }

  function applyZoomToDiagrams() {
    if (!window.svgPanZoom) {
      return;
    }

    document.querySelectorAll(".mermaid-container svg").forEach((svgElement) => {
      if (svgElement.getAttribute(panZoomKey) === "true") {
        return;
      }

      window.svgPanZoom(svgElement, {
        controlIconsEnabled: true,
        zoomScaleSensitivity: 0.4,
        minZoom: 0.5,
        maxZoom: 20,
      });
      svgElement.setAttribute(panZoomKey, "true");
    });
  }

  async function renderMarkdown(content) {
    const preview = document.getElementById("markdown-preview");
    if (!preview || !window.marked) {
      return;
    }

    preview.innerHTML = window.marked.parse(content ?? "");
    addCodeBlockDecorations();
    await renderMermaidDiagrams();
    applyZoomToDiagrams();

    if (window.generateTOC) {
      window.generateTOC();
    }
  }

  configureMarked();
  window.renderMarkdown = renderMarkdown;
})();
