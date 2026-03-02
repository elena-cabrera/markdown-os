# Feature Plan: File Operations (Sidebar)

## Goal

Add file management actions to the sidebar in folder mode:

-   A **"+"** button beside the search bar to create a new file in the workspace root (or in a selected folder).
-   A **right-click context menu** on any file or folder entry that exposes **Rename** and **Delete**.

---

## UI Changes

### "+" Create button

In `index.html`, the `.sidebar-header` div currently only contains the `#file-tree-search` input. Add a `+` button as a sibling:

```html
<div class="sidebar-header">
  <input
    type="text"
    id="file-tree-search"
    placeholder="Search files..."
    class="file-tree-search"
    aria-label="Search files"
  />
  <button
    id="file-tree-new-file"
    class="sidebar-action-btn"
    type="button"
    title="New file"
    aria-label="New file"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12.001 5v14.002m7.001-7H5"/>
    </svg>
  </button>
</div>

```

Style `.sidebar-action-btn` similarly to `.history-button` but smaller (24 × 24 px) to match the compact sidebar aesthetic:

```css
.sidebar-action-btn {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-bg);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.sidebar-action-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.sidebar-action-btn svg {
  width: 14px;
  height: 14px;
}

```

Also update `.sidebar-header` to `display: flex; align-items: center; gap: 6px;` so the search input and button sit on the same row.

### Context menu

A positioned `<div class="context-menu">` is built and appended to `<body>` dynamically (not in static HTML). Right-clicking a file or folder in the tree opens it at the cursor position.

**Items for a file:**

-   Rename (pencil icon)
-   Delete (trash icon)

**Items for a folder:**

-   Rename (pencil icon)

No duplicate action (removed from original scope).

Context menu SVG icons:

-   **Rename**: the pencil SVG provided by the user
-   **Delete**: the trash SVG provided by the user

CSS (append to `styles.css`):

```css
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 160px;
  background: var(--modal-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--modal-shadow);
  padding: 4px 0;
}
.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  font-size: 0.875rem;
  color: var(--text);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}
.context-menu-item:hover,
.context-menu-item:focus {
  background: var(--accent-soft);
  color: var(--accent);
}
.context-menu-item svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.context-menu-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

```

---

## Backend Changes

### `markdown_os/directory_handler.py`

Add three new public methods:

#### `create_file(relative_path: str) -> Path`

-   Validate the resolved path stays within `self._directory` (reuse existing `_validate_path` check pattern).
-   Validate extension is `.md` (or allow any — keep permissive since the user types the name).
-   Raise `FileWriteError` if the file already exists.
-   `parent.mkdir(parents=True, exist_ok=True)` to create any intermediate directories.
-   `path.write_text("", encoding="utf-8")` to create an empty file.
-   Return the resolved absolute `Path`.

#### `rename_path(relative_path: str, new_name: str) -> Path`

-   Reject `new_name` containing `/`, `\`, or being empty.
-   Source = `self._directory / relative_path` (resolved, checked to be within workspace).
-   Destination = `source.parent / new_name`.
-   Raise `FileReadError` if source does not exist.
-   Raise `FileWriteError` if destination already exists.
-   Call `source.rename(destination)`.
-   Evict `source` key from `self._file_handlers` cache.
-   Return the new absolute `Path`.

#### `delete_file(relative_path: str) -> None`

-   Validate within workspace.
-   Raise `FileReadError` if path does not exist.
-   Raise `FileWriteError` if path is a directory (scope is files only).
-   Call `path.unlink()`.
-   Evict from `self._file_handlers` cache.

### `markdown_os/server.py`

Add three Pydantic request models and three routes inside `create_app()`.

All three return HTTP 404 when `mode != "folder"`.

```text
POST /api/files/create   body: { path: str }          → { path: str }
POST /api/files/rename   body: { path: str, new_name: str } → { path: str }
DELETE /api/files/delete body: { path: str }          → { ok: true }

```

Error mapping:

-   `FileWriteError` (conflict) → 409
-   `FileReadError` (not found) → 404
-   `ValueError` (bad input) → 400

---

## Frontend Changes (`markdown_os/static/js/file-tree.js`)

### "+" button handler

Attach a `click` listener to `#file-tree-new-file` inside `initFileTree()`. On click:

1.  Use `window.markdownDialogs.prompt("New file", "Enter filename (e.g. notes.md):")` to get a name.
2.  `POST /api/files/create` with `{ path: name }`.
3.  On success, call `loadFileTree()` to refresh the sidebar, then open the new file by navigating to it (`window.location.search = ?file=<path>` or via the existing tab-opening logic).

### Context menu

A self-contained set of functions within `file-tree.js`:

-   `showContextMenu(event, path, type)` — `event.preventDefault()`, build and position the menu.
-   `hideContextMenu()` — remove the active menu element from the DOM.
-   `positionContextMenu(menu, x, y)` — clamp to viewport (8 px margin) accounting for right/bottom overflow.
-   `handleNewFile(parentPath)` — prompt for name, POST create, refresh tree.
-   `handleRename(path, type)` — prompt for new name (pre-filled with current basename), POST rename, refresh tree, then call `window.fileTabs?.renameTab(oldPath, newPath)` so any open tab updates its label and internal path reference.
-   `handleDelete(path)` — confirm with `window.markdownDialogs.confirm(...)`, DELETE the file, refresh tree, then call `window.fileTabs?.closeTab(path)` to close any open tab for the deleted file.

Attach `contextmenu` listeners when building file and folder `<button>` elements in the tree renderer (the existing loop in `renderTree()`).

Dismiss listeners (document-level `click`, `keydown Escape`, `scroll` capture) registered once via `bindContextMenuDismiss()`, called from `initFileTree()`.

### Tab integration (`tabs.js`)

Two new public methods exposed on `window.fileTabs`:

-   **`renameTab(oldRelativePath, newRelativePath)`** — updates the tab's `data-path`, label text, and the in-memory content/scroll cache key if the tab is currently open.
-   **`closeTab(relativePath)`** — if a tab with that path is open, close it (re-using the existing close logic, but bypassing the unsaved-changes guard since the file is already gone).

---

## Files to Change

| File | Change |
| --- | --- |
| `markdown_os/static/index.html` | Add `#file-tree-new-file` button to `.sidebar-header` |
| `markdown_os/static/css/styles.css` | Add `.sidebar-action-btn` styles; update `.sidebar-header` to flex; add `.context-menu*` styles |
| `markdown_os/static/js/file-tree.js` | "+" handler, context menu system, `contextmenu` listeners on tree nodes |
| `markdown_os/static/js/tabs.js` | Add `renameTab()` and `closeTab(path)` public methods |
| `markdown_os/directory_handler.py` | Add `create_file()`, `rename_path()`, `delete_file()` |
| `markdown_os/server.py` | Add request models + three route handlers |
| `tests/test_directory_handler.py` | Tests for the three new methods |
| `tests/test_server.py` | Tests for the three new endpoints |

---

## Out of Scope

-   Moving files between directories (drag-and-drop)
-   Creating folders
-   Duplicating files
-   Renaming folders recursively (updating all contained file paths in open tabs)