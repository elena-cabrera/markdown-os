(() => {
  const WRAPPER_CLASS = "table-editor-wrapper";
  const ACTIVE_CLASS = "table-editor-active";
  const HIGHLIGHT_ROW_CLASS = "table-row-highlight";
  const HIGHLIGHT_COL_CLASS = "table-col-highlight";
  const DELETE_ROW_PREVIEW_CLASS = "table-row-delete-preview";
  const DELETE_COL_PREVIEW_CLASS = "table-col-delete-preview";
  const DELETE_TABLE_PREVIEW_CLASS = "table-delete-preview";
  const DELETE_TABLE_SELECTED_CLASS = "table-delete-selected";
  const DELETE_SELECTED_WRAPPER_CLASS = "table-editor-delete-selected";

  let changeCallback = null;
  let rootElement = null;
  let pendingDeleteWrapper = null;
  const wrapperCursorKeys = new WeakMap();

  function getCursorKey(position) {
    if (!position) {
      return null;
    }
    return `${position.rowIndex}:${position.colIndex}`;
  }

  function storeCursorPosition(wrapper, position) {
    if (!position) {
      return;
    }
    wrapper.dataset.tableCursorRow = String(position.rowIndex);
    wrapper.dataset.tableCursorCol = String(position.colIndex);
    wrapperCursorKeys.set(wrapper, getCursorKey(position));
  }

  function getStoredCursorPosition(wrapper) {
    const rowIndex = wrapper.dataset.tableCursorRow;
    const colIndex = wrapper.dataset.tableCursorCol;
    if (rowIndex === undefined || colIndex === undefined) {
      return null;
    }
    return {
      rowIndex: Number(rowIndex),
      colIndex: Number(colIndex),
    };
  }

  function closestEditorBlock(node, root) {
    if (!node || !root) {
      return null;
    }

    const startNode = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!startNode || !root.contains(startNode)) {
      return null;
    }

    if (startNode.closest("td, th")) {
      return null;
    }

    return startNode.closest("p, div, li, blockquote, h1, h2, h3, h4, h5, h6");
  }

  function isRangeAtBlockStart(range, block) {
    const probe = range.cloneRange();
    probe.setStart(block, 0);
    const prefixText = (probe.toString() || "").replace(/\u00a0/g, " ").trim();
    return prefixText.length === 0;
  }

  function placeCaretAtBlockStart(block) {
    const selection = window.getSelection();
    if (!selection || !block) {
      return;
    }

    const range = document.createRange();
    if (block.firstChild) {
      range.setStart(block.firstChild, 0);
    } else {
      range.setStart(block, 0);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function getTableWrapperBeforeBlock(block) {
    const previous = block?.previousElementSibling;
    if (!previous?.classList?.contains(WRAPPER_CLASS)) {
      return null;
    }
    return previous;
  }

  function clearPendingTableDeletion() {
    if (!pendingDeleteWrapper) {
      return;
    }

    pendingDeleteWrapper.classList.remove(DELETE_SELECTED_WRAPPER_CLASS);
    pendingDeleteWrapper
      .querySelector("table")
      ?.classList.remove(DELETE_TABLE_SELECTED_CLASS);
    pendingDeleteWrapper = null;
  }

  function selectTableForDeletion(wrapper) {
    clearPendingTableDeletion();
    pendingDeleteWrapper = wrapper;
    wrapper.classList.add(DELETE_SELECTED_WRAPPER_CLASS);
    wrapper.querySelector("table")?.classList.add(DELETE_TABLE_SELECTED_CLASS);
  }

  function clearPendingTableDeletionIfNeeded() {
    if (!pendingDeleteWrapper || !rootElement) {
      return;
    }

    const selection = window.getSelection();
    if (!selection?.anchorNode || !rootElement.contains(selection.anchorNode)) {
      clearPendingTableDeletion();
      return;
    }

    if (selection.anchorNode.parentElement?.closest?.("td, th")) {
      clearPendingTableDeletion();
      return;
    }

    const block = closestEditorBlock(selection.anchorNode, rootElement);
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (
      block &&
      block.previousElementSibling === pendingDeleteWrapper &&
      range &&
      isRangeAtBlockStart(range, block)
    ) {
      return;
    }

    clearPendingTableDeletion();
  }

  function handleTableBackspace(root) {
    const selection = window.getSelection();
    if (!selection?.isCollapsed || selection.rangeCount === 0) {
      return false;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode || !root.contains(anchorNode)) {
      return false;
    }

    if (anchorNode.parentElement?.closest?.('[contenteditable="false"]')) {
      return false;
    }

    const block = closestEditorBlock(anchorNode, root);
    if (!block) {
      return false;
    }

    const range = selection.getRangeAt(0);
    if (!isRangeAtBlockStart(range, block)) {
      return false;
    }

    const tableWrapper = getTableWrapperBeforeBlock(block);
    if (!tableWrapper) {
      return false;
    }

    if (pendingDeleteWrapper === tableWrapper) {
      deleteTable(tableWrapper, { focusBlock: block });
      return true;
    }

    selectTableForDeletion(tableWrapper);
    placeCaretAtBlockStart(block);
    syncTableEditorState();
    return true;
  }

  function getEffectiveCursorPosition(wrapper, table) {
    return getCursorPosition(table) || getStoredCursorPosition(wrapper);
  }

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

  function createBodyCell(text = "") {
    const cell = document.createElement("td");
    if (text) {
      cell.textContent = text;
    }
    return cell;
  }

  function ensureTableBody(table) {
    let tbody = table.querySelector(":scope > tbody");
    if (!tbody) {
      tbody = document.createElement("tbody");
      table.appendChild(tbody);
    }
    return tbody;
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

    const colCount = Math.max(refRow.cells.length, 1);
    const isHeaderRow = refRow.parentElement?.tagName === "THEAD";

    if (isHeaderRow && position === "after") {
      const tbody = ensureTableBody(table);
      const newRow = document.createElement("tr");
      for (let index = 0; index < colCount; index += 1) {
        newRow.appendChild(createBodyCell());
      }
      tbody.insertBefore(newRow, tbody.firstChild);
      return newRow;
    }

    const newRow = document.createElement("tr");
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

  function getTableContentRect(table) {
    const rows = getTableRows(table);
    if (rows.length === 0) {
      return table.getBoundingClientRect();
    }

    let top = Infinity;
    let left = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    rows.forEach((row) => {
      const rect = row.getBoundingClientRect();
      top = Math.min(top, rect.top);
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    });

    return {
      top,
      left,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
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
    table.classList.remove(DELETE_TABLE_PREVIEW_CLASS);
  }

  function ensureInsertPreviewLayer(wrapper) {
    let layer = wrapper.querySelector(".table-insert-preview-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "table-insert-preview-layer";
      layer.setAttribute("contenteditable", "false");
      layer.setAttribute("aria-hidden", "true");
      wrapper.appendChild(layer);
    }
    return layer;
  }

  function clearInsertPreview(wrapper) {
    wrapper?.querySelector(".table-insert-preview-layer")?.replaceChildren();
  }

  function previewInsertRow(wrapper, table, rowIndex) {
    const rows = getTableRows(table);
    const row = rows[rowIndex];
    if (!row) {
      return;
    }

    const layer = ensureInsertPreviewLayer(wrapper);
    layer.replaceChildren();

    const contentRect = getTableContentRect(table);
    const wrapperRect = wrapper.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const line = document.createElement("div");
    line.className = "table-insert-preview-line table-insert-preview-line-row";
    line.style.left = `${contentRect.left - wrapperRect.left}px`;
    line.style.top = `${rowRect.bottom - wrapperRect.top}px`;
    line.style.width = `${contentRect.width}px`;
    layer.appendChild(line);
  }

  function previewInsertColumn(wrapper, table, colIndex) {
    const position = getCursorPosition(table);
    const rows = getTableRows(table);
    const row = rows[position?.rowIndex ?? 0];
    const cell = row?.cells[colIndex];
    if (!cell) {
      return;
    }

    const layer = ensureInsertPreviewLayer(wrapper);
    layer.replaceChildren();

    const contentRect = getTableContentRect(table);
    const wrapperRect = wrapper.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const line = document.createElement("div");
    line.className = "table-insert-preview-line table-insert-preview-line-column";
    line.style.left = `${cellRect.right - wrapperRect.left}px`;
    line.style.top = `${contentRect.top - wrapperRect.top}px`;
    line.style.height = `${contentRect.height}px`;
    layer.appendChild(line);
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

  function previewDeleteTable(table) {
    clearDeletePreview(table);
    table.classList.add(DELETE_TABLE_PREVIEW_CLASS);
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

  function createStepperGroup(kind, removeLabel, addLabel, wrapper, table) {
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
      clearInsertPreview(wrapper);
      if (removeButton.disabled) {
        return;
      }

      const position = getEffectiveCursorPosition(wrapper, table);
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
    addButton.className = "table-stepper-button table-stepper-add-button";
    addButton.dataset.action = `${kind}-add`;
    addButton.textContent = "+";
    addButton.title = addLabel;
    addButton.setAttribute("aria-label", addLabel);
    addButton.addEventListener("mouseenter", () => {
      clearDeletePreview(table);
      const position = getEffectiveCursorPosition(wrapper, table);
      if (!position) {
        return;
      }

      if (kind === "row") {
        previewInsertRow(wrapper, table, position.rowIndex);
        return;
      }

      previewInsertColumn(wrapper, table, position.colIndex);
    });
    addButton.addEventListener("mouseleave", () => {
      clearInsertPreview(wrapper);
    });

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
      wrapper,
      table,
    );
    const columnStepper = createStepperGroup(
      "column",
      "Remove column",
      "Add column right",
      wrapper,
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
      clearInsertPreview(wrapper);
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

    deleteTableButton.addEventListener("mouseenter", () => {
      clearInsertPreview(wrapper);
      previewDeleteTable(table);
    });
    deleteTableButton.addEventListener("mouseleave", () => {
      clearDeletePreview(table);
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
    const position = getEffectiveCursorPosition(wrapper, table);
    if (!position) {
      return;
    }

    clearDeletePreview(table);
    clearInsertPreview(wrapper);

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

  function handleEdgeAction(wrapper, table, action) {
    const position = getEffectiveCursorPosition(wrapper, table);
    if (!position) {
      return;
    }

    const { rowIndex, colIndex } = position;
    clearDeletePreview(table);
    clearInsertPreview(wrapper);

    if (action === "row-insert") {
      const newRow = insertRowAt(table, rowIndex, "after");
      refreshTableControls(wrapper);
      placeCaretInCell(newRow?.cells[colIndex] || newRow?.cells[0]);
      updateToolbarCounts(wrapper, table);
      emitChange();
      return;
    }

    if (action === "row-delete") {
      if (deleteRowAt(table, rowIndex)) {
        refreshTableControls(wrapper);
        const nextRows = getTableRows(table);
        const focusRow = nextRows[Math.min(rowIndex, nextRows.length - 1)];
        placeCaretInCell(focusRow?.cells[colIndex] || focusRow?.cells[0]);
        updateToolbarCounts(wrapper, table);
        emitChange();
      }
      return;
    }

    if (action === "column-insert") {
      insertColumnAt(table, colIndex, "after");
      refreshTableControls(wrapper);
      const nextCell = getTableRows(table)[rowIndex]?.cells[colIndex + 1];
      placeCaretInCell(nextCell);
      updateToolbarCounts(wrapper, table);
      emitChange();
      return;
    }

    if (action === "column-delete") {
      if (deleteColumnAt(table, colIndex)) {
        refreshTableControls(wrapper);
        const nextColIndex = Math.min(colIndex, getColumnCount(table) - 1);
        placeCaretInCell(getTableRows(table)[rowIndex]?.cells[nextColIndex]);
        updateToolbarCounts(wrapper, table);
        emitChange();
      }
    }
  }

  function ensureEdgeLayer(wrapper, table) {
    let edgeLayer = wrapper.querySelector(".table-edge-layer");
    if (edgeLayer) {
      return edgeLayer;
    }

    edgeLayer = document.createElement("div");
    edgeLayer.className = "table-edge-layer";
    edgeLayer.setAttribute("contenteditable", "false");

    const handleSpecs = [
      {
        action: "row-delete",
        kind: "delete",
        title: "Delete row",
        className: "table-row-delete-handle",
      },
      {
        action: "row-insert",
        kind: "add",
        title: "Insert row below",
        className: "table-row-insert-handle",
      },
      {
        action: "column-insert",
        kind: "add",
        title: "Insert column right",
        className: "table-col-insert-handle",
      },
      {
        action: "column-delete",
        kind: "delete",
        title: "Delete column",
        className: "table-col-delete-handle",
      },
    ];

    handleSpecs.forEach((spec) => {
      const button = createIconButton(spec.kind, spec.title, spec.className);
      button.dataset.tableAction = spec.action;
      edgeLayer.appendChild(button);
    });

    edgeLayer.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) {
        event.preventDefault();
      }
    });

    edgeLayer.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-table-action]");
      if (!button || button.disabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleEdgeAction(wrapper, table, button.dataset.tableAction);
    });

    edgeLayer.addEventListener(
      "mouseover",
      (event) => {
        const button = event.target.closest("button[data-table-action]");
        if (!button || button.disabled) {
          return;
        }

        const position = getEffectiveCursorPosition(wrapper, table);
        if (!position) {
          return;
        }

        const action = button.dataset.tableAction;
        if (action === "row-insert") {
          clearDeletePreview(table);
          previewInsertRow(wrapper, table, position.rowIndex);
          return;
        }

        if (action === "column-insert") {
          clearDeletePreview(table);
          previewInsertColumn(wrapper, table, position.colIndex);
          return;
        }

        if (action === "row-delete") {
          clearInsertPreview(wrapper);
          previewDeleteRow(table, position.rowIndex);
          return;
        }

        if (action === "column-delete") {
          clearInsertPreview(wrapper);
          previewDeleteColumn(table, position.colIndex);
        }
      },
      true,
    );

    edgeLayer.addEventListener("mouseleave", () => {
      clearInsertPreview(wrapper);
      clearDeletePreview(table);
    });

    wrapper.insertBefore(edgeLayer, table);
    return edgeLayer;
  }

  function updateEdgeHandlePositions(wrapper, table, cursorPosition) {
    const edgeLayer = ensureEdgeLayer(wrapper, table);
    if (!cursorPosition) {
      edgeLayer.querySelectorAll("button[data-table-action]").forEach((button) => {
        button.hidden = true;
      });
      return edgeLayer;
    }

    storeCursorPosition(wrapper, cursorPosition);

    const rows = getTableRows(table);
    const row = rows[cursorPosition.rowIndex];
    const cell = row?.cells[cursorPosition.colIndex];
    if (!row || !cell) {
      edgeLayer.querySelectorAll("button[data-table-action]").forEach((button) => {
        button.hidden = true;
      });
      return edgeLayer;
    }

    const contentRect = getTableContentRect(table);
    const wrapperRect = wrapper.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const rowBorderTop = rowRect.bottom - wrapperRect.top;
    const columnBorderLeft = cellRect.right - wrapperRect.left;
    const contentTop = contentRect.top - wrapperRect.top;
    const contentLeft = contentRect.left - wrapperRect.left;
    const handleHalf = 12;
    const rowInsertTop = rowBorderTop - handleHalf;
    const rowDeleteTop = cellRect.top - wrapperRect.top + cellRect.height / 2 - handleHalf;

    const rowInsert = edgeLayer.querySelector(".table-row-insert-handle");
    const rowDelete = edgeLayer.querySelector(".table-row-delete-handle");
    const colInsert = edgeLayer.querySelector(".table-col-insert-handle");
    const colDelete = edgeLayer.querySelector(".table-col-delete-handle");

    if (rowInsert) {
      rowInsert.hidden = false;
      rowInsert.style.top = `${rowInsertTop}px`;
      rowInsert.style.left = `${contentLeft - 34}px`;
    }

    if (rowDelete) {
      rowDelete.hidden = false;
      rowDelete.style.top = `${rowDeleteTop}px`;
      rowDelete.style.left = `${contentLeft - 34}px`;
      rowDelete.disabled = rows.length <= 1;
    }

    if (colInsert) {
      colInsert.hidden = false;
      colInsert.style.left = `${columnBorderLeft - 12}px`;
      colInsert.style.top = `${contentTop - 34}px`;
    }

    if (colDelete) {
      colDelete.hidden = false;
      colDelete.style.left = `${cellRect.left - wrapperRect.left + cellRect.width / 2 - 12}px`;
      colDelete.style.top = `${contentTop - 34}px`;
      colDelete.disabled = getColumnCount(table) <= 1;
    }

    return edgeLayer;
  }

  function buildEdgeLayer(wrapper, table) {
    const cursorPosition = getEffectiveCursorPosition(wrapper, table);
    return updateEdgeHandlePositions(wrapper, table, cursorPosition);
  }

  function refreshTableControls(wrapper) {
    const table = wrapper.querySelector("table");
    if (!table) {
      return;
    }
    buildFloatingToolbar(wrapper, table);
    const position = getEffectiveCursorPosition(wrapper, table);
    updateEdgeHandlePositions(wrapper, table, position);
  }

  function setWrapperActive(wrapper, isActive) {
    const wasActive = wrapper.classList.contains(ACTIVE_CLASS);
    wrapper.classList.toggle(ACTIVE_CLASS, isActive);
    const table = wrapper.querySelector("table");
    if (isActive) {
      buildFloatingToolbar(wrapper, table);
      const position = getCursorPosition(table);
      const cursorKey = getCursorKey(position);
      if (!wasActive || cursorKey !== wrapperCursorKeys.get(wrapper)) {
        updateEdgeHandlePositions(wrapper, table, position);
      }
      return;
    }

    if (wasActive) {
      clearHighlights(table);
      clearDeletePreview(table);
      clearInsertPreview(wrapper);
    }
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

  function deleteTable(wrapper, options = {}) {
    if (pendingDeleteWrapper === wrapper) {
      clearPendingTableDeletion();
    }

    const focusBlock = options.focusBlock;
    if (focusBlock?.isConnected) {
      wrapper.remove();
      placeCaretAtBlockStart(focusBlock);
    } else {
      const replacement = document.createElement("p");
      replacement.innerHTML = "<br>";
      wrapper.replaceWith(replacement);
      placeCaretAtBlockStart(replacement);
    }

    const selection = window.getSelection();
    if (!selection) {
      emitChange();
      syncTableEditorState();
      return;
    }

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
      wrapper.classList.remove(DELETE_SELECTED_WRAPPER_CLASS);
      wrapper
        .querySelectorAll(
          ".table-edge-layer, .table-floating-toolbar, .table-edge-controls, .table-insert-preview-layer",
        )
        .forEach((node) => {
          node.remove();
        });
      const table = wrapper.querySelector("table");
      table?.classList.remove(DELETE_TABLE_SELECTED_CLASS, DELETE_TABLE_PREVIEW_CLASS);
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
      clearPendingTableDeletionIfNeeded();
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
    handleTableBackspace,
  };
})();
