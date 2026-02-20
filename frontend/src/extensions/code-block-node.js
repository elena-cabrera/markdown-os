import CodeBlock from "@tiptap/extension-code-block";
import { renderMermaidNodeView } from "./mermaid-node.js";

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
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
  fallbackInput.remove();
}

function countLines(source) {
  if (!source) {
    return 1;
  }
  return Math.max(1, source.split("\n").length);
}

function createLineNumbers(lineCount) {
  const gutter = document.createElement("div");
  gutter.className = "code-line-numbers";
  gutter.setAttribute("aria-hidden", "true");
  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber += 1) {
    const line = document.createElement("span");
    line.className = "code-line-number";
    line.textContent = String(lineNumber);
    gutter.appendChild(line);
  }
  return gutter;
}

function normalizeLanguageValue(language) {
  if (!language || typeof language !== "string") {
    return "text";
  }
  return language.trim().toLowerCase() || "text";
}

export const MarkdownOSCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement("div");
      dom.className = "code-block";
      dom.dataset.blockLanguage = normalizeLanguageValue(node.attrs.language);

      const header = document.createElement("div");
      header.className = "code-block-header";
      const languageLabel = document.createElement("span");
      languageLabel.className = "code-language-label";
      const headerActions = document.createElement("div");
      headerActions.className = "code-block-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "copy-button";
      editButton.textContent = "Edit";

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "copy-button";
      copyButton.textContent = "Copy";

      headerActions.appendChild(editButton);
      headerActions.appendChild(copyButton);
      header.appendChild(languageLabel);
      header.appendChild(headerActions);

      const content = document.createElement("div");
      content.className = "code-block-content";

      let lineGutter = createLineNumbers(countLines(node.textContent));
      content.appendChild(lineGutter);

      const pre = document.createElement("pre");
      const code = document.createElement("code");
      pre.appendChild(code);
      content.appendChild(pre);

      const mermaidContainer = document.createElement("div");
      mermaidContainer.className = "mermaid-container hidden";

      const editPanel = document.createElement("div");
      editPanel.className = "wysiwyg-code-editor hidden";
      const languageInput = document.createElement("input");
      languageInput.type = "text";
      languageInput.className = "wysiwyg-code-language-input";
      languageInput.placeholder = "Language (e.g. python, javascript, mermaid)";
      const textarea = document.createElement("textarea");
      textarea.className = "wysiwyg-code-editor-textarea";
      const panelActions = document.createElement("div");
      panelActions.className = "wysiwyg-code-editor-actions";
      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.className = "copy-button";
      applyButton.textContent = "Apply";
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "copy-button";
      cancelButton.textContent = "Cancel";
      panelActions.appendChild(applyButton);
      panelActions.appendChild(cancelButton);
      editPanel.appendChild(languageInput);
      editPanel.appendChild(textarea);
      editPanel.appendChild(panelActions);

      dom.appendChild(header);
      dom.appendChild(content);
      dom.appendChild(mermaidContainer);
      dom.appendChild(editPanel);

      let currentNode = node;

      function setLineNumbers(source) {
        const nextGutter = createLineNumbers(countLines(source));
        content.replaceChild(nextGutter, lineGutter);
        lineGutter = nextGutter;
      }

      function renderCode() {
        const language = normalizeLanguageValue(currentNode.attrs.language);
        const source = currentNode.textContent || "";
        dom.dataset.blockLanguage = language;
        languageLabel.textContent = language;

        code.className = "";
        code.textContent = source;
        setLineNumbers(source);

        if (language === "mermaid") {
          content.classList.add("hidden");
          mermaidContainer.classList.remove("hidden");
          renderMermaidNodeView(mermaidContainer, source);
          return;
        }

        mermaidContainer.classList.add("hidden");
        content.classList.remove("hidden");
        if (window.hljs && language !== "text") {
          code.classList.add(`language-${language}`);
          window.hljs.highlightElement(code);
        }
      }

      function openEditorPanel() {
        languageInput.value = normalizeLanguageValue(currentNode.attrs.language);
        textarea.value = currentNode.textContent || "";
        editPanel.classList.remove("hidden");
        textarea.focus();
      }

      function closeEditorPanel() {
        editPanel.classList.add("hidden");
      }

      function applyEdits() {
        const position = getPos();
        if (typeof position !== "number") {
          return;
        }

        const nextLanguage = normalizeLanguageValue(languageInput.value);
        const nextSource = textarea.value || "";
        const from = position + 1;
        const to = position + currentNode.nodeSize - 1;
        const transaction = editor.view.state.tr.insertText(nextSource, from, to);
        transaction.setNodeMarkup(position, undefined, {
          ...currentNode.attrs,
          language: nextLanguage,
        });
        editor.view.dispatch(transaction);
        editor.chain().focus().setTextSelection(position + 1).run();
        closeEditorPanel();
      }

      editButton.addEventListener("click", openEditorPanel);
      cancelButton.addEventListener("click", closeEditorPanel);
      applyButton.addEventListener("click", applyEdits);
      copyButton.addEventListener("click", async () => {
        try {
          await copyToClipboard(currentNode.textContent || "");
          copyButton.textContent = "Copied";
          copyButton.classList.add("copied");
          window.setTimeout(() => {
            copyButton.textContent = "Copy";
            copyButton.classList.remove("copied");
          }, 1200);
        } catch (_error) {
          copyButton.textContent = "Copy failed";
          window.setTimeout(() => {
            copyButton.textContent = "Copy";
          }, 1200);
        }
      });

      const onThemeChanged = () => {
        if (normalizeLanguageValue(currentNode.attrs.language) === "mermaid") {
          renderMermaidNodeView(mermaidContainer, currentNode.textContent || "");
        }
      };
      window.addEventListener("markdown-os:theme-changed", onThemeChanged);

      renderCode();

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== currentNode.type.name) {
            return false;
          }
          currentNode = updatedNode;
          renderCode();
          return true;
        },
        ignoreMutation(mutation) {
          if (editPanel.contains(mutation.target)) {
            return true;
          }
          return false;
        },
        stopEvent(event) {
          if (editPanel.contains(event.target) || header.contains(event.target)) {
            return true;
          }
          return false;
        },
        destroy() {
          window.removeEventListener("markdown-os:theme-changed", onThemeChanged);
        },
      };
    };
  },
});
