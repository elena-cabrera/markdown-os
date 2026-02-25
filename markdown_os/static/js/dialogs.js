(() => {
  const { focusWithoutScroll } = window.sharedUtils;

  function captureEditorScrollTop() {
    const editorContainer = document.getElementById("editor-container");
    if (!editorContainer) {
      return null;
    }

    return editorContainer.scrollTop;
  }

  function restoreEditorScrollTop(scrollTop) {
    if (!Number.isFinite(scrollTop)) {
      return;
    }

    const editorContainer = document.getElementById("editor-container");
    if (!editorContainer) {
      return;
    }

    window.requestAnimationFrame(() => {
      editorContainer.scrollTop = scrollTop;
    });
  }

  function getElements() {
    return {
      overlay: document.getElementById("custom-dialog-overlay"),
      modal: document.getElementById("custom-dialog-modal"),
      title: document.getElementById("custom-dialog-title"),
      message: document.getElementById("custom-dialog-message"),
      fields: document.getElementById("custom-dialog-fields"),
      input1Label: document.getElementById("custom-dialog-input1-label"),
      input2Label: document.getElementById("custom-dialog-input2-label"),
      input1: document.getElementById("custom-dialog-input1"),
      input2: document.getElementById("custom-dialog-input2"),
      confirmButton: document.getElementById("custom-dialog-confirm"),
      cancelButton: document.getElementById("custom-dialog-cancel"),
    };
  }

  function hideFields(elements) {
    elements.fields?.classList.add("hidden");
    elements.input1?.classList.add("hidden");
    elements.input2?.classList.add("hidden");
    elements.input1Label?.classList.add("hidden");
    elements.input2Label?.classList.add("hidden");
  }

  function hideDialog(elements) {
    elements.modal?.classList.add("hidden");
    elements.overlay?.classList.add("hidden");
  }

  function showDialog(elements) {
    elements.overlay?.classList.remove("hidden");
    elements.modal?.classList.remove("hidden");
  }

  async function openDialog(config) {
    const elements = getElements();
    if (
      !elements.overlay ||
      !elements.modal ||
      !elements.title ||
      !elements.message ||
      !elements.fields ||
      !elements.input1 ||
      !elements.input2 ||
      !elements.input1Label ||
      !elements.input2Label ||
      !elements.confirmButton ||
      !elements.cancelButton
    ) {
      return null;
    }

    const previousFocus = document.activeElement;
    const previousScrollTop = captureEditorScrollTop();

    elements.title.textContent = config.title || "Confirm action";

    if (config.message) {
      elements.message.textContent = config.message;
      elements.message.classList.remove("hidden");
    } else {
      elements.message.textContent = "";
      elements.message.classList.add("hidden");
    }

    hideFields(elements);

    elements.input1.value = "";
    elements.input2.value = "";
    elements.input1.placeholder = "";
    elements.input2.placeholder = "";

    const fields = config.fields || [];
    if (fields.length > 0) {
      elements.fields.classList.remove("hidden");
    }

    if (fields[0]) {
      elements.input1Label.textContent = fields[0].label || "Value";
      elements.input1Label.classList.remove("hidden");
      elements.input1.classList.remove("hidden");
      elements.input1.type = fields[0].type || "text";
      elements.input1.value = fields[0].value || "";
      elements.input1.placeholder = fields[0].placeholder || "";
    }

    if (fields[1]) {
      elements.input2Label.textContent = fields[1].label || "Value";
      elements.input2Label.classList.remove("hidden");
      elements.input2.classList.remove("hidden");
      elements.input2.type = fields[1].type || "text";
      elements.input2.value = fields[1].value || "";
      elements.input2.placeholder = fields[1].placeholder || "";
    }

    elements.confirmButton.textContent = config.confirmText || "Confirm";
    elements.cancelButton.textContent = config.cancelText || "Cancel";

    elements.confirmButton.classList.remove("btn-primary", "btn-secondary", "btn-tertiary");
    elements.confirmButton.classList.add(
      config.confirmVariant === "danger" ? "btn-secondary" : "btn-primary",
    );

    showDialog(elements);

    return new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        document.removeEventListener("keydown", onKeyDown);
        elements.overlay.onclick = null;
        elements.confirmButton.onclick = null;
        elements.cancelButton.onclick = null;
      };

      const finish = (result) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        hideDialog(elements);
        hideFields(elements);

        focusWithoutScroll(previousFocus);
        restoreEditorScrollTop(previousScrollTop);

        resolve(result);
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          finish(null);
        } else if (event.key === "Enter") {
          if (event.target === elements.cancelButton) {
            return;
          }
          finish({
            input1: elements.input1.value,
            input2: elements.input2.value,
          });
        }
      };

      document.addEventListener("keydown", onKeyDown);

      elements.confirmButton.onclick = () => {
        finish({
          input1: elements.input1.value,
          input2: elements.input2.value,
        });
      };
      elements.cancelButton.onclick = () => {
        finish(null);
      };
      elements.overlay.onclick = () => {
        finish(null);
      };

      if (fields.length > 0) {
        focusWithoutScroll(elements.input1);
        elements.input1.select();
      } else {
        focusWithoutScroll(elements.confirmButton);
      }
    });
  }

  async function confirm(config) {
    const result = await openDialog({
      title: config?.title || "Confirm action",
      message: config?.message || "",
      confirmText: config?.confirmText || "Confirm",
      cancelText: config?.cancelText || "Cancel",
      confirmVariant: config?.confirmVariant || "primary",
      fields: [],
    });

    return Boolean(result);
  }

  async function prompt(config) {
    const result = await openDialog({
      title: config?.title || "Enter value",
      message: config?.message || "",
      confirmText: config?.confirmText || "Save",
      cancelText: config?.cancelText || "Cancel",
      confirmVariant: config?.confirmVariant || "primary",
      fields: [
        {
          label: config?.label || "Value",
          value: config?.value || "",
          placeholder: config?.placeholder || "",
          type: config?.type || "text",
        },
      ],
    });

    if (!result) {
      return null;
    }
    return result.input1;
  }

  async function promptPair(config) {
    const result = await openDialog({
      title: config?.title || "Edit values",
      message: config?.message || "",
      confirmText: config?.confirmText || "Save",
      cancelText: config?.cancelText || "Cancel",
      confirmVariant: config?.confirmVariant || "primary",
      fields: [
        {
          label: config?.first?.label || "Value",
          value: config?.first?.value || "",
          placeholder: config?.first?.placeholder || "",
          type: config?.first?.type || "text",
        },
        {
          label: config?.second?.label || "Value",
          value: config?.second?.value || "",
          placeholder: config?.second?.placeholder || "",
          type: config?.second?.type || "text",
        },
      ],
    });

    if (!result) {
      return null;
    }

    return {
      first: result.input1,
      second: result.input2,
    };
  }

  window.markdownDialogs = {
    confirm,
    prompt,
    promptPair,
  };
})();
