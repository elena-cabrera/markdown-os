(() => {
  const HANDLE_OFFSET = 4;
  const MENU_GAP = 4;

  let _editorRoot = null;
  let _activeTable = null;
  let _hoveredRow = null;
  let _hoveredColIndex = -1;
  let _menuTarget = null;
  let _menuType = null;

  function emitChange() {
    if (window.wysiwyg?._emitChange) {
      window.wysiwyg._emitChange();
      return;
    }
    const event = new Event("input", { bubbles: true });
    _editorRoot?.dispatchEvent(event);
  }

  function getTableCells(table) {
    /**
     * Collects all rows (thead + tbody) and returns them as an array.
     *
     * Args:
     * - table (HTMLTableElement): The target table.
     *
     * Returns:
     * - Array<HTMLTableRowElement>: All rows in the table.
     */
    return Array.from(table.querySelectorAll("tr"));
  }

  function getColumnCount(table) {
    /**
     * Returns the number of columns in a table.
     *
     * Args:
     * - table (HTMLTableElement): The target table.
     *
     * Returns:
     * - number: Column count derived from the first row.
     */
    const firstRow = table.querySelector("tr");
    if (!firstRow) return 0;
    return firstRow.querySelectorAll("th, td").length;
  }

  function isHeaderRow(row) {
    /**
     * Determines if a row is the table header row.
     *
     * Args:
     * - row (HTMLTableRowElement): The row to check.
     *
     * Returns:
     * - boolean: True if the row is inside a <thead>.
     */
    return row.closest("thead") !== null;
  }

  function createCell(isHeader) {
    /**
     * Creates a new table cell element.
     *
     * Args:
     * - isHeader (boolean): If true creates <th>, otherwise <td>.
     *
     * Returns:
     * - HTMLTableCellElement: The new cell with a non-breaking space.
     */
    const cell = document.createElement(isHeader ? "th" : "td");
    cell.innerHTML = "&nbsp;";
    return cell;
  }

  function insertRowAbove(table, referenceRow) {
    /**
     * Inserts a new row above the reference row.
     *
     * Args:
     * - table (HTMLTableElement): The table to modify.
     * - referenceRow (HTMLTableRowElement): The row to insert above.
     */
    const colCount = getColumnCount(table);
    if (colCount === 0) return;

    if (isHeaderRow(referenceRow)) {
      const tbody = table.querySelector("tbody") || table.appendChild(document.createElement("tbody"));
      const firstBodyRow = tbody.querySelector("tr");
      const newRow = document.createElement("tr");
      for (let i = 0; i < colCount; i++) newRow.appendChild(createCell(false));
      if (firstBodyRow) {
        tbody.insertBefore(newRow, firstBodyRow);
      } else {
        tbody.appendChild(newRow);
      }
    } else {
      const newRow = document.createElement("tr");
      for (let i = 0; i < colCount; i++) newRow.appendChild(createCell(false));
      referenceRow.parentNode.insertBefore(newRow, referenceRow);
    }
    emitChange();
  }

  function insertRowBelow(table, referenceRow) {
    /**
     * Inserts a new row below the reference row.
     *
     * Args:
     * - table (HTMLTableElement): The table to modify.
     * - referenceRow (HTMLTableRowElement): The row to insert below.
     */
    const colCount = getColumnCount(table);
    if (colCount === 0) return;

    const newRow = document.createElement("tr");
    for (let i = 0; i < colCount; i++) newRow.appendChild(createCell(false));

    if (isHeaderRow(referenceRow)) {
      const tbody = table.querySelector("tbody") || table.appendChild(document.createElement("tbody"));
      const firstBodyRow = tbody.querySelector("tr");
      if (firstBodyRow) {
        tbody.insertBefore(newRow, firstBodyRow);
      } else {
        tbody.appendChild(newRow);
      }
    } else {
      const nextSibling = referenceRow.nextElementSibling;
      if (nextSibling) {
        referenceRow.parentNode.insertBefore(newRow, nextSibling);
      } else {
        referenceRow.parentNode.appendChild(newRow);
      }
    }
    emitChange();
  }

  function deleteRow(table, targetRow) {
    /**
     * Deletes a row from the table. Header rows cannot be deleted.
     *
     * Args:
     * - table (HTMLTableElement): The table to modify.
     * - targetRow (HTMLTableRowElement): The row to remove.
     */
    if (isHeaderRow(targetRow)) return;

    const rows = getTableCells(table);
    const bodyRows = rows.filter((r) => !isHeaderRow(r));
    if (bodyRows.length <= 1) return;

    targetRow.remove();
    emitChange();
  }

  function insertColumnAt(table, index, side) {
    /**
     * Inserts a new column at the specified position.
     *
     * Args:
     * - table (HTMLTableElement): The table to modify.
     * - index (number): The column index relative to which to insert.
     * - side (string): "left" or "right".
     */
    const insertIndex = side === "right" ? index + 1 : index;
    const rows = getTableCells(table);

    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      const isHead = isHeaderRow(row);
      const newCell = createCell(isHead);

      if (insertIndex >= cells.length) {
        row.appendChild(newCell);
      } else {
        row.insertBefore(newCell, cells[insertIndex]);
      }
    });
    emitChange();
  }

  function deleteColumn(table, index) {
    /**
     * Deletes a column from the table at the given index.
     *
     * Args:
     * - table (HTMLTableElement): The table to modify.
     * - index (number): The column index to delete.
     */
    const colCount = getColumnCount(table);
    if (colCount <= 1) return;

    const rows = getTableCells(table);
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      if (cells[index]) {
        cells[index].remove();
      }
    });
    emitChange();
  }

  function getOrCreateContainer() {
    /**
     * Gets (or creates) the absolutely-positioned controls container.
     *
     * Returns:
     * - HTMLDivElement: The table controls container element.
     */
    let container = document.getElementById("table-controls-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "table-controls-container";
      document.body.appendChild(container);
    }
    return container;
  }

  function clearControls() {
    /**
     * Removes all table control elements from the container.
     */
    const container = document.getElementById("table-controls-container");
    if (container) container.innerHTML = "";
    closeMenu();
  }

  function createSvgIcon(type) {
    /**
     * Creates an SVG icon element for table control buttons.
     *
     * Args:
     * - type (string): "grip", "plus", or "drag".
     *
     * Returns:
     * - SVGElement: The SVG icon.
     */
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("fill", "currentColor");

    if (type === "plus") {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M8 2.5v11M2.5 8h11");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.8");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("fill", "none");
      svg.appendChild(path);
    } else {
      const dots = [
        [5, 3], [10, 3],
        [5, 7], [10, 7],
        [5, 11], [10, 11],
      ];
      dots.forEach(([cx, cy]) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", String(cx));
        circle.setAttribute("cy", String(cy));
        circle.setAttribute("r", "1.4");
        svg.appendChild(circle);
      });
    }
    return svg;
  }

  function positionRowHandle(handle, row, table) {
    /**
     * Positions a row handle element to the left of the row.
     *
     * Args:
     * - handle (HTMLElement): The handle element.
     * - row (HTMLTableRowElement): The target row.
     * - table (HTMLTableElement): The parent table.
     */
    const rowRect = row.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();

    handle.style.position = "fixed";
    handle.style.top = `${rowRect.top + rowRect.height / 2 - 12}px`;
    handle.style.left = `${tableRect.left - 28 - HANDLE_OFFSET}px`;
  }

  function positionColumnHandle(handle, colIndex, table) {
    /**
     * Positions a column handle element above the column.
     *
     * Args:
     * - handle (HTMLElement): The handle element.
     * - colIndex (number): The column index.
     * - table (HTMLTableElement): The parent table.
     */
    const firstRow = table.querySelector("tr");
    if (!firstRow) return;

    const cells = Array.from(firstRow.querySelectorAll("th, td"));
    if (!cells[colIndex]) return;

    const cellRect = cells[colIndex].getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();

    handle.style.position = "fixed";
    handle.style.top = `${tableRect.top - 28 - HANDLE_OFFSET}px`;
    handle.style.left = `${cellRect.left + cellRect.width / 2 - 12}px`;
  }

  function createRowHandle(table, row) {
    /**
     * Creates a row grip handle button.
     *
     * Args:
     * - table (HTMLTableElement): The parent table.
     * - row (HTMLTableRowElement): The target row.
     *
     * Returns:
     * - HTMLButtonElement: The grip handle button.
     */
    const handle = document.createElement("button");
    handle.className = "table-row-handle";
    handle.type = "button";
    handle.title = "Row options";
    handle.setAttribute("aria-label", "Row options");
    handle.appendChild(createSvgIcon("grip"));
    positionRowHandle(handle, row, table);

    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    handle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openRowMenu(table, row, handle);
    });

    return handle;
  }

  function createColumnHandle(table, colIndex) {
    /**
     * Creates a column grip handle button.
     *
     * Args:
     * - table (HTMLTableElement): The parent table.
     * - colIndex (number): The target column index.
     *
     * Returns:
     * - HTMLButtonElement: The grip handle button.
     */
    const handle = document.createElement("button");
    handle.className = "table-col-handle";
    handle.type = "button";
    handle.title = "Column options";
    handle.setAttribute("aria-label", "Column options");
    handle.appendChild(createSvgIcon("grip"));
    positionColumnHandle(handle, colIndex, table);

    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    handle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openColumnMenu(table, colIndex, handle);
    });

    return handle;
  }

  function createAddRowButton(table) {
    /**
     * Creates a "+" button that appears below the table to add a row.
     *
     * Args:
     * - table (HTMLTableElement): The parent table.
     *
     * Returns:
     * - HTMLButtonElement: The add-row button.
     */
    const btn = document.createElement("button");
    btn.className = "table-add-row-btn";
    btn.type = "button";
    btn.title = "Add row";
    btn.setAttribute("aria-label", "Add row");
    btn.appendChild(createSvgIcon("plus"));

    const tableRect = table.getBoundingClientRect();
    btn.style.position = "fixed";
    btn.style.top = `${tableRect.bottom + 2}px`;
    btn.style.left = `${tableRect.left + tableRect.width / 2 - 14}px`;

    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rows = getTableCells(table);
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        insertRowBelow(table, lastRow);
        refreshControls();
      }
    });

    return btn;
  }

  function createAddColumnButton(table) {
    /**
     * Creates a "+" button that appears to the right of the table to add a column.
     *
     * Args:
     * - table (HTMLTableElement): The parent table.
     *
     * Returns:
     * - HTMLButtonElement: The add-column button.
     */
    const btn = document.createElement("button");
    btn.className = "table-add-col-btn";
    btn.type = "button";
    btn.title = "Add column";
    btn.setAttribute("aria-label", "Add column");
    btn.appendChild(createSvgIcon("plus"));

    const tableRect = table.getBoundingClientRect();
    const firstRow = table.querySelector("tr");
    const rowRect = firstRow ? firstRow.getBoundingClientRect() : tableRect;

    btn.style.position = "fixed";
    btn.style.top = `${rowRect.top + (tableRect.height) / 2 - 14}px`;
    btn.style.left = `${tableRect.right + 2}px`;

    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const colCount = getColumnCount(table);
      if (colCount > 0) {
        insertColumnAt(table, colCount - 1, "right");
        refreshControls();
      }
    });

    return btn;
  }

  function openRowMenu(table, row, anchorEl) {
    /**
     * Opens a context menu for row operations.
     *
     * Args:
     * - table (HTMLTableElement): The parent table.
     * - row (HTMLTableRowElement): The target row.
     * - anchorEl (HTMLElement): The element to anchor the menu to.
     */
    closeMenu();
    _menuTarget = { table, row };
    _menuType = "row";

    const menu = document.createElement("div");
    menu.className = "table-context-menu";
    menu.setAttribute("role", "menu");

    const isHead = isHeaderRow(row);
    const bodyRows = getTableCells(table).filter((r) => !isHeaderRow(r));
    const canDelete = !isHead && bodyRows.length > 1;

    const items = [
      { label: "Insert row above", action: () => { insertRowAbove(table, row); closeMenu(); refreshControls(); } },
      { label: "Insert row below", action: () => { insertRowBelow(table, row); closeMenu(); refreshControls(); } },
    ];

    if (canDelete) {
      items.push({ label: "Delete row", action: () => { deleteRow(table, row); closeMenu(); refreshControls(); }, danger: true });
    }

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "table-context-menu-item" + (item.danger ? " danger" : "");
      btn.type = "button";
      btn.textContent = item.label;
      btn.setAttribute("role", "menuitem");
      btn.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
      btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); item.action(); });
      menu.appendChild(btn);
    });

    const container = getOrCreateContainer();
    container.appendChild(menu);

    const anchorRect = anchorEl.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = `${anchorRect.bottom + MENU_GAP}px`;
    menu.style.left = `${anchorRect.left}px`;

    requestAnimationFrame(() => {
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.bottom > window.innerHeight) {
        menu.style.top = `${anchorRect.top - menuRect.height - MENU_GAP}px`;
      }
      if (menuRect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
      }
    });
  }

  function openColumnMenu(table, colIndex, anchorEl) {
    /**
     * Opens a context menu for column operations.
     *
     * Args:
     * - table (HTMLTableElement): The parent table.
     * - colIndex (number): The target column index.
     * - anchorEl (HTMLElement): The element to anchor the menu to.
     */
    closeMenu();
    _menuTarget = { table, colIndex };
    _menuType = "column";

    const menu = document.createElement("div");
    menu.className = "table-context-menu";
    menu.setAttribute("role", "menu");

    const colCount = getColumnCount(table);
    const canDelete = colCount > 1;

    const items = [
      { label: "Insert column left", action: () => { insertColumnAt(table, colIndex, "left"); closeMenu(); refreshControls(); } },
      { label: "Insert column right", action: () => { insertColumnAt(table, colIndex, "right"); closeMenu(); refreshControls(); } },
    ];

    if (canDelete) {
      items.push({ label: "Delete column", action: () => { deleteColumn(table, colIndex); closeMenu(); refreshControls(); }, danger: true });
    }

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "table-context-menu-item" + (item.danger ? " danger" : "");
      btn.type = "button";
      btn.textContent = item.label;
      btn.setAttribute("role", "menuitem");
      btn.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
      btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); item.action(); });
      menu.appendChild(btn);
    });

    const container = getOrCreateContainer();
    container.appendChild(menu);

    const anchorRect = anchorEl.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = `${anchorRect.bottom + MENU_GAP}px`;
    menu.style.left = `${anchorRect.left}px`;

    requestAnimationFrame(() => {
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.bottom > window.innerHeight) {
        menu.style.top = `${anchorRect.top - menuRect.height - MENU_GAP}px`;
      }
      if (menuRect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
      }
    });
  }

  function closeMenu() {
    /**
     * Closes any open table context menu.
     */
    const menus = document.querySelectorAll(".table-context-menu");
    menus.forEach((m) => m.remove());
    _menuTarget = null;
    _menuType = null;
  }

  function refreshControls() {
    /**
     * Rebuilds the table controls for the currently active table.
     */
    if (!_activeTable || !_editorRoot?.contains(_activeTable)) {
      clearControls();
      _activeTable = null;
      return;
    }
    renderControlsForTable(_activeTable, _hoveredRow, _hoveredColIndex);
  }

  function renderControlsForTable(table, hoveredRow, hoveredColIndex) {
    /**
     * Renders all table controls (handles, add buttons) for a given table.
     *
     * Args:
     * - table (HTMLTableElement): The target table.
     * - hoveredRow (HTMLTableRowElement|null): The row currently hovered.
     * - hoveredColIndex (number): The column index currently hovered (-1 if none).
     */
    const container = getOrCreateContainer();
    const existingMenus = container.querySelectorAll(".table-context-menu");
    const menuElements = Array.from(existingMenus);

    const nonMenuChildren = Array.from(container.children).filter(
      (child) => !child.classList.contains("table-context-menu")
    );
    nonMenuChildren.forEach((child) => child.remove());

    if (hoveredRow) {
      container.appendChild(createRowHandle(table, hoveredRow));
    }

    if (hoveredColIndex >= 0) {
      container.appendChild(createColumnHandle(table, hoveredColIndex));
    }

    container.appendChild(createAddRowButton(table));
    container.appendChild(createAddColumnButton(table));
  }

  function getCellColumnIndex(cell) {
    /**
     * Returns the column index of a table cell within its row.
     *
     * Args:
     * - cell (HTMLTableCellElement): The cell element.
     *
     * Returns:
     * - number: The column index.
     */
    const row = cell.closest("tr");
    if (!row) return -1;
    const cells = Array.from(row.querySelectorAll("th, td"));
    return cells.indexOf(cell);
  }

  function handleMouseMove(event) {
    /**
     * Handles mousemove events to detect which table/row/column is hovered.
     *
     * Args:
     * - event (MouseEvent): The mousemove event.
     */
    const target = event.target;

    if (
      target.closest(".table-context-menu") ||
      target.closest(".table-row-handle") ||
      target.closest(".table-col-handle") ||
      target.closest(".table-add-row-btn") ||
      target.closest(".table-add-col-btn")
    ) {
      return;
    }

    const cell = target.closest("th, td");
    const table = cell?.closest("#wysiwyg-editor table");

    if (!table || !cell) {
      if (_activeTable) {
        _activeTable = null;
        _hoveredRow = null;
        _hoveredColIndex = -1;
        clearControls();
      }
      return;
    }

    const row = cell.closest("tr");
    const colIndex = getCellColumnIndex(cell);

    if (table === _activeTable && row === _hoveredRow && colIndex === _hoveredColIndex) {
      return;
    }

    _activeTable = table;
    _hoveredRow = row;
    _hoveredColIndex = colIndex;

    renderControlsForTable(table, row, colIndex);
  }

  function handleMouseLeave(event) {
    /**
     * Handles mouseleave from the editor area.
     *
     * Args:
     * - event (MouseEvent): The mouseleave event.
     */
    const relatedTarget = event.relatedTarget;

    if (
      relatedTarget?.closest?.("#table-controls-container") ||
      relatedTarget?.closest?.(".table-context-menu")
    ) {
      return;
    }

    setTimeout(() => {
      const hovered = document.querySelector(
        "#table-controls-container:hover, .table-context-menu:hover"
      );
      if (!hovered) {
        _activeTable = null;
        _hoveredRow = null;
        _hoveredColIndex = -1;
        clearControls();
      }
    }, 100);
  }

  function handleContainerMouseLeave(event) {
    /**
     * Handles mouseleave from the controls container.
     *
     * Args:
     * - event (MouseEvent): The mouseleave event.
     */
    const relatedTarget = event.relatedTarget;

    if (relatedTarget?.closest?.("#wysiwyg-editor table")) {
      return;
    }
    if (relatedTarget?.closest?.(".table-context-menu")) {
      return;
    }

    setTimeout(() => {
      const hoveredEditor = document.querySelector("#wysiwyg-editor table:hover");
      const hoveredControl = document.querySelector(
        "#table-controls-container:hover, .table-context-menu:hover"
      );
      if (!hoveredEditor && !hoveredControl) {
        _activeTable = null;
        _hoveredRow = null;
        _hoveredColIndex = -1;
        clearControls();
      }
    }, 100);
  }

  function handleDocumentClick(event) {
    /**
     * Closes context menus when clicking outside.
     *
     * Args:
     * - event (MouseEvent): The click event.
     */
    if (
      event.target.closest(".table-context-menu") ||
      event.target.closest(".table-row-handle") ||
      event.target.closest(".table-col-handle")
    ) {
      return;
    }
    closeMenu();
  }

  function handleScroll() {
    /**
     * Repositions controls on scroll.
     */
    if (_activeTable && _editorRoot?.contains(_activeTable)) {
      renderControlsForTable(_activeTable, _hoveredRow, _hoveredColIndex);
    } else {
      clearControls();
    }
  }

  function init() {
    /**
     * Initializes table controls by binding event listeners.
     */
    _editorRoot = document.getElementById("wysiwyg-editor");
    if (!_editorRoot) return;

    _editorRoot.addEventListener("mousemove", handleMouseMove);
    _editorRoot.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("click", handleDocumentClick);

    const editorContainer = document.getElementById("editor-container");
    if (editorContainer) {
      editorContainer.addEventListener("scroll", handleScroll);
    }

    const controlsContainer = getOrCreateContainer();
    controlsContainer.addEventListener("mouseleave", handleContainerMouseLeave);
  }

  function cleanup() {
    /**
     * Removes all event listeners and cleans up DOM elements.
     */
    if (_editorRoot) {
      _editorRoot.removeEventListener("mousemove", handleMouseMove);
      _editorRoot.removeEventListener("mouseleave", handleMouseLeave);
    }
    document.removeEventListener("click", handleDocumentClick);

    const editorContainer = document.getElementById("editor-container");
    if (editorContainer) {
      editorContainer.removeEventListener("scroll", handleScroll);
    }

    clearControls();
    const container = document.getElementById("table-controls-container");
    if (container) container.remove();

    _editorRoot = null;
    _activeTable = null;
    _hoveredRow = null;
    _hoveredColIndex = -1;
  }

  window.MarkdownOS = window.MarkdownOS || {};
  window.MarkdownOS.tableControls = { init, cleanup };
})();
