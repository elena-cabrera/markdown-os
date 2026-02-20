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

function renderKatexExpression(container, expression, displayMode) {
  if (!window.katex) {
    container.textContent = expression;
    return;
  }

  try {
    window.katex.render(expression, container, {
      throwOnError: false,
      displayMode,
      output: "htmlAndMathml",
    });
    container.classList.remove("math-error");
  } catch (_error) {
    container.innerHTML = "";
    container.classList.add("math-error");
    if (displayMode) {
      const errorBlock = document.createElement("div");
      errorBlock.className = "math-error-block";
      errorBlock.textContent = `Invalid LaTeX:\n${expression}`;
      container.appendChild(errorBlock);
    } else {
      container.textContent = expression;
    }
  }
}

function buildDisplayMathPanel(expression) {
  const wrapper = document.createElement("div");
  wrapper.className = "math-display";
  wrapper.dataset.mathExpression = expression;

  renderKatexExpression(wrapper, expression, true);

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "copy-button math-copy-button";
  copyButton.textContent = "Copy LaTeX";
  copyButton.addEventListener("click", async () => {
    await copyToClipboard(expression);
    copyButton.textContent = "Copied";
    copyButton.classList.add("copied");
    window.setTimeout(() => {
      copyButton.textContent = "Copy LaTeX";
      copyButton.classList.remove("copied");
    }, 1200);
  });
  wrapper.appendChild(copyButton);

  return wrapper;
}

function insertInlineMathSyntax(editor, expression = "x") {
  if (!editor) {
    return;
  }
  editor.chain().focus().insertContent(`$${expression}$`).run();
}

function insertDisplayMathSyntax(editor, expression = "x^2") {
  if (!editor) {
    return;
  }
  editor
    .chain()
    .focus()
    .insertContent(`\n$$\n${expression}\n$$\n`)
    .run();
}

export {
  buildDisplayMathPanel,
  insertDisplayMathSyntax,
  insertInlineMathSyntax,
  renderKatexExpression,
};
