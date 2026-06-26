(() => {
  const WRAPPER_CLASS = "table-editor-wrapper";
  const ACTIVE_CLASS = "table-editor-active";
  const HIGHLIGHT_ROW_CLASS = "table-row-highlight";
  const HIGHLIGHT_COL_CLASS = "table-col-highlight";
  const DELETE_ROW_PREVIEW_CLASS = "table-row-delete-preview";
  const DELETE_COL_PREVIEW_CLASS = "table-col-delete-preview";

  let changeCallback = null;
  let rootElement = null;

  function iconSvg(kind) {
    if (kind === "add") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>';
    }
    if (kind === "delete") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" aria-hidden="true"><path d="m19.5 5.5l-.62 10.025c-.158 2.561-.237 3.842-.88 4.763a4 4 0 0 1-1.2 1.128c-.957.584-2.24.584-4.806.584c-2.57 0-3.855 0-4.814-.585a4 4 0 0 1-1.2-1.13c-.642-.922-.72-2.205-.874-4.77L4.5 5.5M3 5.5h18m-4.944 0l-.683-1.408c-.453-.936-.68-1.403-1.071-1.695a2 2 0 0 0-.275-.172C13.594 2 13.074 2 12.035 2c-1.066 0-1.599 0-2.04.234a2 2 0 0 0-.278.18c-.395.303-.616.788-1.058 1.757L8.053 5.5m1.447 11v-6m5 6v-6"/></svg>';
    }
    return "";
  }

  function createIconButton(kind, title, className = "table-control-button") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.setAttribute("contenteditable", "false");
    button.innerHTML = iconSvg(kind);
    return button;
  }

  function emitChange() {
    changeCallback?.();
  }

  function getTableRows(table) {
    return Array.from(
      table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr"),
    );
  }

  function getColumnCount(table) {
    const rows = getTableRows(table);
    if (rows.length === 0) {
      return 0;
    }
    return Math.max(...rows.map((row) => row.cells.length), 0);
  }

  function getCellTagForRow(row) {
    return row.parentElement?.tagName === "THEAD" ? "th" : "td";
  }

  function createCellForRow(row, text = "") {
    const cell = document.createElement(getCellTagForRow(row));
    if (text) {
      cell.textContent = text;
    } else if (cell.tagName === "TH") {
      cell.textContent = "Column";
    }
    return cell;
  }

  function placeCaretInCell(cell) {
    if (!cell) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    if (cell.childNodes.length === 0) {
      cell.appendChild(document.createTextNode(""));
    }

    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function getActiveCell(table) {
    const selection = window.getSelection();
    if (!selection?.anchorNode) {
      return null;
    }

    let node = selection.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    const cell = node?.closest?.("td, th");
    if (!cell || !table.contains(cell)) {
      return null;
    }

    return cell;
  }

  function getActiveTableWrapper() {
    if (!rootElement) {
      return null;
    }

    const selection = window.getSelection();
    if (!selection?.anchorNode) {
      return null;
    }

    let node = selection.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    const cell = node?.closest?.("td, th");
    if (!cell || !rootElement.contains(cell)) {
      return null;
    }

    const wrapper = cell.closest(`.${WRAPPER_CLASS}`);
    if (!wrapper || !rootElement.contains(wrapper)) {
      return null;
    }

    return wrapper;
  }

  function getCellPosition(table, cell) {
    const rows = getTableRows(table);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const colIndex = Array.from(rows[rowIndex].cells).indexOf(cell);
      if (colIndex >= 0) {
        return { rowIndex, colIndex };
      }
    }
    return null;
  }

  function getCursorPosition(table) {
    const activeCell = getActiveCell(table);
    if (!activeCell) {
      return null;
    }
    return getCellPosition(table, activeCell);
  }

  function insertRowAt(table, rowIndex, position) {
    const rows = getTableRows(table);
    const refRow = rows[rowIndex];
    if (!refRow) {
      return null;
    }

    const newRow = document.createElement("tr");
    const colCount = Math.max(refRow.cells.length, 1);
    for (let index = 0; index < colCount; index += 1) {
      newRow.appendChild(createCellForRow(refRow));
    }

    const parent = refRow.parentElement;
    if (position === "before") {
      parent.insertBefore(newRow, refRow);
    } else {
      parent.insertBefore(newRow, refRow.nextSibling);
    }

    return newRow;
  }

  function deleteRowAt(table, rowIndex) {
    const rows = getTableRows(table);
    if (rows.length <= 1) {
      return false;
    }

    rows[rowIndex]?.remove();
    return true;
  }

  function insertColumnAt(table, colIndex, position) {
    const rows = getTableRows(table);
    rows.forEach((row) => {
      const refCell = row.cells[colIndex];
      const cell = createCellForRow(row);
      if (position === "before") {
        row.insertBefore(cell, refCell || null);
        return;
      }
      row.insertBefore(cell, refCell?.nextSibling || null);
    });
  }

  function deleteColumnAt(table, colIndex) {
    if (getColumnCount(table) <= 1) {
      return false;
    }

    getTableRows(table).forEach((row) => {
      row.cells[colIndex]?.remove();
    });
    return true;
  }

  function clearDeletePreview(table) {
    if (!table) {
      return;
    }

    table
      .querySelectorAll(
        `.${DELETE_ROW_PREVIEW_CLASS}, .${DELETE_COL_PREVIEW_CLASS}`,
      )
      .forEach((node) => {
        node.classList.remove(DELETE_ROW_PREVIEW_CLASS, DELETE_COL_PREVIEW_CLASS);
      });
  }

  function clearHighlights(table) {
    if (!table) {
      return;
    }

    table
      .querySelectorAll(`.${HIGHLIGHT_ROW_CLASS}, .${HIGHLIGHT_COL_CLASS}`)
      .forEach((node) => {
        node.classList.remove(HIGHLIGHT_ROW_CLASS, HIGHLIGHT_COL_CLASS);
      });
  }

  function highlightRow(table, rowIndex) {
    clearHighlights(table);
    getTableRows(table)[rowIndex]?.classList.add(HIGHLIGHT_ROW_CLASS);
  }

  function highlightColumn(table, colIndex) {
    clearHighlights(table);
    getTableRows(table).forEach((row) => {
      row.cells[colIndex]?.classList.add(HIGHLIGHT_COL_CLASS);
    });
  }

  function previewDeleteRow(table, rowIndex) {
    clearDeletePreview(table);
    getTableRows(table)[rowIndex]?.classList.add(DELETE_ROW_PREVIEW_CLASS);
  }

  function previewDeleteColumn(table, colIndex) {
    clearDeletePreview(table);
    getTableRows(table).forEach((row) => {
      row.cells[colIndex]?.classList.add(DELETE_COL_PREVIEW_CLASS);
    });
  }

  function createTableElement() {
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headerOne = document.createElement("th");
    headerOne.textContent = "Column 1";
    const headerTwo = document.createElement("th");
    headerTwo.textContent = "Column 2";
    headerRow.appendChild(headerOne);
    headerRow.appendChild(headerTwo);
    thead.appendChild(headerRow);

    const tbody = document.createElement("tbody");
    const bodyRow = document.createElement("tr");
    const cellOne = document.createElement("td");
    cellOne.textContent = "Value";
    const cellTwo = document.createElement("td");
    cellTwo.textContent = "Value";
    bodyRow.appendChild(cellOne);
    bodyRow.appendChild(cellTwo);
    tbody.appendChild(bodyRow);

    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
  }

  function formatCountLabel(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function updateToolbarCounts(wrapper, table) {
    const rowCount = getTableRows(table).length;
    const colCount = getColumnCount(table);
    const rowLabel = wrapper.querySelector('[data-stepper-count="row"]');
    const colLabel = wrapper.querySelector('[data-stepper-count="column"]');
    const rowRemove = wrapper.querySelector('[data-action="row-remove"]');
    const colRemove = wrapper.querySelector('[data-action="column-remove"]');

    if (rowLabel) {
      rowLabel.textContent = formatCountLabel(rowCount, "row", "rows");
    }
    if (colLabel) {
      colLabel.textContent = formatCountLabel(colCount, "column", "columns");
    }
    if (rowRemove) {
      rowRemove.disabled = rowCount <= 1;
    }
    if (colRemove) {
      colRemove.disabled = colCount <= 1;
    }
  }

  function createStepperGroup(kind, removeLabel, addLabel, table) {
    const group = document.createElement("div");
    group.className = "table-stepper-group";
    group.setAttribute("contenteditable", "false");

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "table-stepper-button table-stepper-remove-button";
    removeButton.dataset.action = `${kind}-remove`;
    removeButton.textContent = "−";
    removeButton.title = removeLabel;
    removeButton.setAttribute("aria-label", removeLabel);
    removeButton.addEventListener("mouseenter", () => {
      if (removeButton.disabled) {
        return;
      }

      const position = getCursorPosition(table);
      if (!position) {
        return;
      }

      if (kind === "row") {
        previewDeleteRow(table, position.rowIndex);
        return;
      }

      previewDeleteColumn(table, position.colIndex);
    });
    removeButton.addEventListener("mouseleave", () => {
      clearDeletePreview(table);
    });

    const countLabel = document.createElement("span");
    countLabel.className = "table-stepper-count";
    countLabel.dataset.stepperCount = kind;

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "table-stepper-button";
    addButton.dataset.action = `${kind}-add`;
    addButton.textContent = "+";
    addButton.title = addLabel;
    addButton.setAttribute("aria-label", addLabel);

    group.appendChild(removeButton);
    group.appendChild(countLabel);
    group.appendChild(addButton);
    return group;
  }

  function buildFloatingToolbar(wrapper, table) {
    let toolbar = wrapper.querySelector(".table-floating-toolbar");
    if (toolbar) {
      updateToolbarCounts(wrapper, table);
      return toolbar;
    }

    toolbar = document.createElement("div");
    toolbar.className = "table-floating-toolbar";
    toolbar.setAttribute("contenteditable", "false");

    const rowStepper = createStepperGroup(
      "row",
      "Remove row",
      "Add row below",
      table,
    );
    const columnStepper = createStepperGroup(
      "column",
      "Remove column",
      "Add column right",
      table,
    );

    const divider = document.createElement("span");
    divider.className = "table-toolbar-divider";
    divider.setAttribute("aria-hidden", "true");

    const deleteTableButton = createIconButton("delete", "Delete table", "table-delete-table-button");

    toolbar.appendChild(rowStepper);
    toolbar.appendChild(columnStepper);
    toolbar.appendChild(divider);
    toolbar.appendChild(deleteTableButton);
    wrapper.appendChild(toolbar);

    toolbar.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) {
        event.preventDefault();
      }
    });

    toolbar.addEventListener("mouseleave", () => {
      clearDeletePreview(table);
    });

    toolbar.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (!actionButton || actionButton.disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleToolbarAction(wrapper, table, actionButton.dataset.action);
    });

    deleteTableButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteTable(wrapper);
    });

    updateToolbarCounts(wrapper, table);
    return toolbar;
  }

  function handleToolbarAction(wrapper, table, action) {
    const position = getCursorPosition(table);
    if (!position) {
      return;
    }

    clearDeletePreview(table);

    if (action === "row-add") {
      const newRow = insertRowAt(table, position.rowIndex, "after");
      refreshTableControls(wrapper);
      placeCaretInCell(newRow?.cells[position.colIndex] || newRow?.cells[0]);
      updateToolbarCounts(wrapper, table);
      emitChange();
      return;
    }

    if (action === "row-remove") {
      if (deleteRowAt(table, position.rowIndex)) {
        refreshTableControls(wrapper);
        const rows = getTableRows(table);
        const focusRow = rows[Math.min(position.rowIndex, rows.length - 1)];
        placeCaretInCell(focusRow?.cells[position.colIndex] || focusRow?.cells[0]);
        updateToolbarCounts(wrapper, table);
        emitChange();
      }
      return;
    }

    if (action === "column-add") {
      insertColumnAt(table, position.colIndex, "after");
      refreshTableControls(wrapper);
      const cell = getTableRows(table)[position.rowIndex]?.cells[position.colIndex + 1];
      placeCaretInCell(cell);
      updateToolbarCounts(wrapper, table);
      emitChange();
      return;
    }

    if (action === "column-remove") {
      if (deleteColumnAt(table, position.colIndex)) {
        refreshTableControls(wrapper);
        const rows = getTableRows(table);
        const colIndex = Math.min(position.colIndex, getColumnCount(table) - 1);
        placeCaretInCell(rows[position.rowIndex]?.cells[colIndex]);
        updateToolbarCounts(wrapper, table);
        emitChange();
      }
    }
  }

  function buildEdgeLayer(wrapper, table) {
    let edgeLayer = wrapper.querySelector(".table-edge-layer");
    if (!edgeLayer) {
      edgeLayer = document.createElement("div");
      edgeLayer.className = "table-edge-layer";
      edgeLayer.setAttribute("contenteditable", "false");
      wrapper.insertBefore(edgeLayer, table);
    }

    edgeLayer.replaceChildren();
    const tableRect = table.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const offsetTop = tableRect.top - wrapperRect.top;
    const offsetLeft = tableRect.left - wrapperRect.left;
    const cursorPosition = getCursorPosition(table);

    const rows = getTableRows(table);
    rows.forEach((row, rowIndex) => {
      const rowRect = row.getBoundingClientRect();
      const top = rowRect.bottom - wrapperRect.top - 12;
      const handle = createIconButton("add", "Insert row below", "table-row-insert-handle");
      handle.style.top = `${top}px`;
      handle.style.left = `${offsetLeft + tableRect.width / 2 - 12}px`;
      handle.addEventListener("mousedown", (event) => event.preventDefault());
      handle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const position = getCursorPosition(table);
        if (!position) {
          return;
        }
        const newRow = insertRowAt(table, rowIndex, "after");
        refreshTableControls(wrapper);
        placeCaretInCell(newRow?.cells[position.colIndex] || newRow?.cells[0]);
        updateToolbarCounts(wrapper, table);
        emitChange();
      });
      edgeLayer.appendChild(handle);

      if (!cursorPosition || cursorPosition.rowIndex !== rowIndex) {
        return;
      }

      const rowDelete = createIconButton("delete", "Delete row", "table-row-delete-handle");
      rowDelete.style.top = `${rowRect.top - wrapperRect.top + rowRect.height / 2 - 12}px`;
      rowDelete.style.left = `${offsetLeft - 34}px`;
      rowDelete.disabled = rows.length <= 1;
      rowDelete.addEventListener("mousedown", (event) => event.preventDefault());
      rowDelete.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const position = getCursorPosition(table);
        if (!position) {
          return;
        }
        if (deleteRowAt(table, position.rowIndex)) {
          refreshTableControls(wrapper);
          const nextRows = getTableRows(table);
          const focusRow = nextRows[Math.min(position.rowIndex, nextRows.length - 1)];
          placeCaretInCell(focusRow?.cells[position.colIndex] || focusRow?.cells[0]);
          updateToolbarCounts(wrapper, table);
          emitChange();
        }
      });
      rowDelete.addEventListener("mouseenter", () => highlightRow(table, rowIndex));
      rowDelete.addEventListener("mouseleave", () => clearHighlights(table));
      edgeLayer.appendChild(rowDelete);
    });

    const colCount = getColumnCount(table);
    if (rows.length > 0) {
      const sampleRow = rows[0];
      for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
        const cell = sampleRow.cells[colIndex];
        if (!cell) {
          continue;
        }

        const cellRect = cell.getBoundingClientRect();
        const insertLeft = cellRect.right - wrapperRect.left - 12;
        const insertTop = offsetTop + tableRect.height / 2 - 12;
        const handle = createIconButton("add", "Insert column right", "table-col-insert-handle");
        handle.style.left = `${insertLeft}px`;
        handle.style.top = `${insertTop}px`;
        handle.addEventListener("mousedown", (event) => event.preventDefault());
        handle.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const position = getCursorPosition(table);
          if (!position) {
            return;
          }
          insertColumnAt(table, colIndex, "after");
          refreshTableControls(wrapper);
          const nextCell = getTableRows(table)[position.rowIndex]?.cells[colIndex + 1];
          placeCaretInCell(nextCell);
          updateToolbarCounts(wrapper, table);
          emitChange();
        });
        edgeLayer.appendChild(handle);

        if (!cursorPosition || cursorPosition.colIndex !== colIndex) {
          continue;
        }

        const colDelete = createIconButton("delete", "Delete column", "table-col-delete-handle");
        colDelete.style.left = `${cellRect.left - wrapperRect.left + cellRect.width / 2 - 12}px`;
        colDelete.style.top = `${offsetTop - 34}px`;
        colDelete.disabled = colCount <= 1;
        colDelete.addEventListener("mousedown", (event) => event.preventDefault());
        colDelete.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const position = getCursorPosition(table);
          if (!position) {
            return;
          }
          if (deleteColumnAt(table, position.colIndex)) {
            refreshTableControls(wrapper);
            const nextColIndex = Math.min(position.colIndex, getColumnCount(table) - 1);
            placeCaretInCell(getTableRows(table)[position.rowIndex]?.cells[nextColIndex]);
            updateToolbarCounts(wrapper, table);
            emitChange();
          }
        });
        colDelete.addEventListener("mouseenter", () => highlightColumn(table, colIndex));
        colDelete.addEventListener("mouseleave", () => clearHighlights(table));
        edgeLayer.appendChild(colDelete);
      }
    }

    return edgeLayer;
  }

  function refreshTableControls(wrapper) {
    const table = wrapper.querySelector("table");
    if (!table) {
      return;
    }
    buildFloatingToolbar(wrapper, table);
    buildEdgeLayer(wrapper, table);
  }

  function setWrapperActive(wrapper, isActive) {
    wrapper.classList.toggle(ACTIVE_CLASS, isActive);
    const table = wrapper.querySelector("table");
    if (isActive) {
      refreshTableControls(wrapper);
      return;
    }
    clearHighlights(table);
    clearDeletePreview(table);
  }

  function syncTableEditorState() {
    if (!rootElement) {
      return;
    }

    const activeWrapper = getActiveTableWrapper();
    rootElement.querySelectorAll(`.${WRAPPER_CLASS}`).forEach((wrapper) => {
      setWrapperActive(wrapper, wrapper === activeWrapper);
    });
  }

  function deleteTable(wrapper) {
    const replacement = document.createElement("p");
    replacement.innerHTML = "<br>";
    wrapper.replaceWith(replacement);

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.setStart(replacement, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    emitChange();
    syncTableEditorState();
  }

  function decorateTableWrapper(wrapper) {
    const table = wrapper.querySelector("table");
    if (!table || wrapper.dataset.tableDecorated === "true") {
      return;
    }

    wrapper.dataset.tableDecorated = "true";
    buildFloatingToolbar(wrapper, table);
    buildEdgeLayer(wrapper, table);
  }

  function wrapTable(table) {
    if (table.closest(`.${WRAPPER_CLASS}`)) {
      return table.closest(`.${WRAPPER_CLASS}`);
    }

    const wrapper = document.createElement("div");
    wrapper.className = WRAPPER_CLASS;
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
    decorateTableWrapper(wrapper);
    return wrapper;
  }

  function decorateTables(root) {
    if (!root) {
      return;
    }

    root.querySelectorAll("table").forEach((table) => {
      if (!table.closest(`.${WRAPPER_CLASS}`)) {
        wrapTable(table);
        return;
      }
      decorateTableWrapper(table.closest(`.${WRAPPER_CLASS}`));
    });
  }

  function cleanupTableWrappers(cloneRoot) {
    cloneRoot.querySelectorAll(`.${WRAPPER_CLASS}`).forEach((wrapper) => {
      wrapper
        .querySelectorAll(
          ".table-edge-layer, .table-floating-toolbar, .table-edge-controls",
        )
        .forEach((node) => {
          node.remove();
        });
      const table = wrapper.querySelector("table");
      if (table) {
        wrapper.replaceWith(table);
      }
    });
  }

  function insertTableAtCaret(root, options = {}) {
    if (!root) {
      return false;
    }

    root.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer;
    const ancestorElement =
      ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor;
    if (!ancestorElement || !root.contains(ancestorElement)) {
      return false;
    }

    const wrapper = document.createElement("div");
    wrapper.className = WRAPPER_CLASS;
    wrapper.appendChild(createTableElement());

    const trailingParagraph = document.createElement("p");
    trailingParagraph.innerHTML = "<br>";

    const fragment = document.createDocumentFragment();
    fragment.appendChild(wrapper);
    fragment.appendChild(trailingParagraph);
    range.insertNode(fragment);

    decorateTableWrapper(wrapper);
    placeCaretInCell(wrapper.querySelector("th, td"));
    syncTableEditorState();
    options.onChange?.();
    return true;
  }

  function initTableEditor(root, onChange) {
    rootElement = root;
    changeCallback = onChange;

    document.addEventListener("selectionchange", () => {
      syncTableEditorState();
    });

    window.addEventListener(
      "resize",
      () => {
        const activeWrapper = getActiveTableWrapper();
        if (activeWrapper) {
          refreshTableControls(activeWrapper);
        }
      },
      { passive: true },
    );
  }

  window.wysiwygTables = {
    initTableEditor,
    insertTableAtCaret,
    decorateTables,
    cleanupTableWrappers,
  };
})();
