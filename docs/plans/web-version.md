# Feature Plan: Free Web Version

## Goal

Ship a free web version of Markdown-OS that runs in the browser without exposing local files or requiring a backend database.

The existing CLI and desktop apps remain filesystem-backed products. The web version shares the editor UI, tabs, themes, WYSIWYG behavior, Mermaid, KaTeX, syntax highlighting, and PDF export, but persists documents in browser storage.

---

## Product Decisions

- **Initial price:** free to use.
- **Initial persistence:** browser-owned IndexedDB workspace.
- **Initial deployment:** static hosting is supported; a local `markdown-os web` command previews the same runtime.
- **No auth or accounts in v1:** avoids backend storage, billing, and moderation concerns until the hosted product needs cloud sync.
- **No filesystem access in web mode:** prevents accidental exposure of user files from the local CLI server.

---

## Runtime Split

Markdown-OS now has three runtime families:

1. **CLI local server:** `markdown-os open <file-or-folder>` uses `FileHandler` or `DirectoryHandler`.
2. **Desktop shell:** starts in `empty` mode, then opens a file or folder through native dialogs.
3. **Web app:** starts in `web` mode and uses browser storage through a frontend storage adapter.

The shared editor talks to `window.MarkdownOS.storage` instead of hardcoding every `/api/*` call. The storage adapter chooses:

- HTTP backend for `file`, `folder`, and `empty` modes.
- IndexedDB backend for `web` mode or static hosts where `/api/mode` is unavailable.

---

## Migration Steps

### Step 1: Introduce web runtime

- Allow `create_app(None, mode="web")`.
- Keep `file` and `folder` requiring handlers.
- Keep `empty` reserved for desktop picker startup.
- Return `{"mode": "web"}` from `/api/mode`.
- Reject direct filesystem API calls in web mode with a clear conflict response.

### Step 2: Add local preview command

- Add `markdown-os web --host 127.0.0.1 --port 8000`.
- Start `build_editor_app(mode="web", handler=None)`.
- Do not warn about file exposure for non-loopback hosts because web mode has no filesystem handler.

### Step 3: Add storage adapter

- Create `markdown_os/static/js/storage-backend.js`.
- Implement HTTP methods for the current server-backed behavior.
- Implement IndexedDB methods for web documents:
  - create file
  - list file tree
  - load content
  - save content
  - rename file or folder prefix
  - delete file
  - import pasted or dropped images as data URLs
- Create `Welcome.md` when the browser workspace is empty.

### Step 4: Route shared frontend through storage

- Update `editor.js`, `tabs.js`, and `file-tree.js` to use `window.MarkdownOS.storage`.
- Treat `web` like folder mode for sidebar, file tree, tabs, and `?file=` routing.
- Keep desktop-only native picker code behind existing desktop guards.
- Skip websocket connection in web mode.

### Step 5: Static deployment

- The existing `markdown_os/static/index.html` can run on a static host.
- If `/api/mode` is unavailable, the storage adapter falls back to web mode.
- A public landing page can link directly to the static editor as the free web version.

---

## Maintenance Rules

- Add editor features once in shared frontend modules whenever possible.
- Put runtime-specific persistence behind `storage-backend.js`.
- Keep local filesystem APIs unavailable in web mode.
- Keep desktop-only OS integrations behind desktop guards.
- Add tests when a frontend module gets a new storage call, mode branch, or runtime-specific exception.

---

## Testing Plan

- Server tests prove `web` mode starts without a handler and does not expose filesystem APIs.
- CLI tests prove `markdown-os web` launches the web runtime.
- Source-level frontend tests prove shared modules delegate persistence to the storage adapter.
- Manual browser testing proves the web runtime creates the default file, edits content, autosaves, reloads persisted content, and creates additional files from the sidebar.
