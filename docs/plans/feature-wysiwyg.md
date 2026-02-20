# WYSIWYG Editor — Implementation Plan

## Context

Markdown-OS currently uses a dual-panel Edit (textarea) / Preview (rendered HTML) model with tab switching. The goal is to replace this with a unified WYSIWYG editor where the editor IS the preview — like Typora, Obsidian, or Notion. Users type and see rendered output in real-time, with no mode switching. Rich blocks (Mermaid diagrams, KaTeX math, code blocks) render inline and are editable via click-to-edit overlays.

The backend API (`/api/content`, `/api/save`) stays unchanged — it always deals in raw markdown strings.

---

## Editor Library: TipTap

**TipTap** (built on ProseMirror) is the recommended choice:
- First-class markdown round-trip via `@tiptap/markdown` (parses markdown in, serializes markdown out)
- Extension system for custom nodes (Mermaid, KaTeX, code blocks)
- Works with vanilla JS (no React/Vue required)
- Used by GitLab, active community, well-documented
- NodeViews API allows vanilla JS DOM rendering for custom blocks

---

## Build Approach: Minimal esbuild Pre-Build

The project currently has zero JS build tools (all CDN). TipTap requires npm packages.

**Solution**: A `frontend/` directory with esbuild that produces a single committed IIFE bundle.

```
frontend/
  package.json          # TipTap + esbuild deps
  build.mjs             # esbuild script
  src/
    tiptap-bundle.js    # Entry point (imports + re-exports)
    extensions/
      mermaid-node.js
      katex-node.js
      code-block-node.js
      image-node.js
```

Output: `markdown_os/static/js/vendor/tiptap-bundle.min.js` (~300-400KB, committed to git).

End users never need npm — they still just `uv sync && uv run markdown-os open`. The build step is developer-only.

---

## Phase Breakdown

### Phase 0 — Build Infrastructure

Set up `frontend/` directory, `package.json`, esbuild script. Produce the TipTap bundle. Add `frontend/node_modules/` to `.gitignore`. Existing app unchanged.

**New files**: `frontend/package.json`, `frontend/build.mjs`, `frontend/src/tiptap-bundle.js`, `markdown_os/static/js/vendor/tiptap-bundle.min.js`
**Modified**: `.gitignore`, `CLAUDE.md`

### Phase 1 — Basic WYSIWYG Editor

Replace `<textarea>` with TipTap. Markdown round-trip works for basic formatting (headings, bold, italic, links, lists, blockquotes, inline code, horizontal rules).

Key changes:
- `index.html`: Replace textarea section with `<div id="wysiwyg-editor">`, remove Edit/Preview tab toggle, add tiptap-bundle script tag
- `editor.js`: Major rewrite — `editor.value` → `tiptapEditor.getMarkdown()`, `onEditorInput` → TipTap's `onUpdate`, remove `switchToTab()`, adapt conflict detection and autosave
- New `wysiwyg.js`: TipTap editor initialization, configuration, lifecycle

**Migration safety**: Introduce a `?wysiwyg=true` query param flag. Legacy mode remains default during development.

### Phase 2 — Formatting Toolbar

Toolbar in the `.tab-nav` area (reusing space from removed Edit/Preview toggle):

```
[B] [I] [~S~] [`code`] | [H1] [H2] [H3] | [bullet] [ordered] [task] | [quote] [---] [code block] | [link] [image] [table] | [undo] [redo]
```

- Active state via TipTap's `editor.isActive()` (buttons highlight based on cursor context)
- All standard keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K, etc.)
- Styled with existing CSS variables for theme compatibility

**New files**: `wysiwyg-toolbar.js`
**Modified**: `index.html`, `styles.css`, `wysiwyg.js`

### Phase 3 — Code Block Extension

Custom TipTap NodeView for fenced code blocks:
- **Default**: Renders with highlight.js syntax highlighting, language label, copy button, line numbers (matching current preview styling)
- **Click-to-edit**: Opens a textarea overlay for raw code editing, language dropdown
- Markdown round-trip: `` ```python\ncode\n``` `` preserves exactly

Uses existing CDN-loaded `hljs` global and existing `.code-block` CSS classes.

**New files**: `frontend/src/extensions/code-block-node.js`

### Phase 4 — Mermaid Diagram Extension

Custom TipTap NodeView (atom node — cursor can't enter it):
- **Default**: Renders SVG via `window.mermaid`, with pan/zoom (`svg-pan-zoom`) and fullscreen button
- **Click-to-edit**: Shows textarea panel below/overlaying the diagram, live re-render on apply
- Theme integration: Listens for `markdown-os:theme-changed` and re-renders with correct Mermaid theme
- Reuses existing fullscreen modal HTML/logic from `markdown.js`

Markdown round-trip: `` ```mermaid\nsource\n``` `` — a specialized code block where `language === "mermaid"`.

**New files**: `frontend/src/extensions/mermaid-node.js`

### Phase 5 — KaTeX Math Extension

Two custom nodes:
- **`mathInline`** (inline atom): Renders `$...$` as KaTeX inline. Click opens small inline input. On blur, re-renders.
- **`mathDisplay`** (block atom): Renders `$$...$$` as KaTeX display mode. Click opens editing panel. Copy-LaTeX button.

Uses existing CDN-loaded `window.katex`. Error states match current `.math-error` / `.math-error-block` styling.

Custom markdown tokenizer hooks in `@tiptap/markdown` for `$` and `$$` syntax.

**New files**: `frontend/src/extensions/katex-node.js`

### Phase 6 — Image Handling & Task Lists & Tables

- **Images**: Custom `UploadImage` extension — intercept paste/drop, upload to `POST /api/images`, insert image node with returned path, show loading placeholder during upload
- **Task lists**: TipTap's TaskList + TaskItem extensions with interactive checkboxes. No regex-based approach needed — TipTap manages document state, checkbox toggle triggers autosave
- **Tables**: TipTap Table extensions (Table, TableRow, TableCell, TableHeader) with inline editing, cell navigation, toolbar button for insertion

**New files**: `frontend/src/extensions/image-node.js`

### Phase 7 — TOC Integration

Simplify `toc.js`:
- Remove edit-mode heading extraction from raw markdown (regex-based) — headings are always DOM elements in WYSIWYG
- Read headings from TipTap editor's `.ProseMirror` DOM
- TOC click scrolls the WYSIWYG container to the heading
- Remove `syncEditorScroll` / `syncPreviewScroll` (only one view now)
- Single `findActiveHeadingIndex` reading from WYSIWYG DOM

**Modified**: `toc.js` (significant simplification)

### Phase 8 — Multi-File Tab Integration

Adapt `tabs.js` for folder mode:
- Store markdown string (via `editor.getMarkdown()`) per tab instead of `textarea.value`
- Tab switching: save current TipTap markdown → store; load new tab → `setContent(markdown)`
- Preserve scroll position per tab
- Remove `isEditMode` from tab data (only one mode now)

**Modified**: `tabs.js`, `editor.js`

### Phase 9 — Theme Integration

- Style `.ProseMirror` container with same CSS variables as `#markdown-preview` (refactor shared rules into `.markdown-content` class)
- highlight.js theme CSS swap continues to work (same mechanism in `theme.js`)
- Mermaid NodeViews listen for `markdown-os:theme-changed` and re-render
- Cursor color matches theme text color
- All 6 themes (light, dark, dracula, nord, lofi, and system default) verified

**Modified**: `styles.css`, `theme.js`

### Phase 10 — Cleanup & Polish

- Remove `markdown.js` (Marked.js pipeline no longer needed)
- Remove Marked.js CDN from `index.html` (keep KaTeX, Mermaid, highlight.js, svg-pan-zoom)
- Remove old textarea, preview container, Edit/Preview tab HTML/CSS
- Remove feature flag — WYSIWYG is the only mode
- Edge cases: raw HTML blocks → non-editable atomic nodes; horizontal rules; unsupported markdown features → graceful raw-text fallback
- Keyboard shortcut audit, accessibility (ARIA labels, keyboard navigation)

**Removed**: `markdown.js`
**Modified**: `index.html`, `editor.js`, `styles.css`

---

## Markdown Round-Trip Fidelity

The biggest risk is lossy serialization. Mitigations:

1. **`@tiptap/markdown`** handles standard constructs (headings, lists, emphasis, links, images, tables, blockquotes, code blocks)
2. **Custom extensions** define `parseMarkdown()` and `renderMarkdown()` hooks for Mermaid/KaTeX/code blocks
3. **"Raw block" fallback** for unsupported constructs (footnotes, definition lists, raw HTML): Store original markdown verbatim, render as non-editable block, serialize back as-is
4. **Test fixture** (`tests/fixtures/round-trip.md`): Every supported construct. Test that `parse(serialize(parse(input)))` equals `parse(input)` structurally

---

## File Change Summary

### New Files

| File | Purpose |
|------|---------|
| `frontend/package.json` | TipTap + esbuild dependencies |
| `frontend/build.mjs` | esbuild build script |
| `frontend/src/tiptap-bundle.js` | Bundle entry point |
| `frontend/src/extensions/mermaid-node.js` | Mermaid diagram NodeView |
| `frontend/src/extensions/katex-node.js` | KaTeX math NodeViews |
| `frontend/src/extensions/code-block-node.js` | Enhanced code block NodeView |
| `frontend/src/extensions/image-node.js` | Image paste/drop upload extension |
| `markdown_os/static/js/vendor/tiptap-bundle.min.js` | Pre-built bundle (committed) |
| `markdown_os/static/js/wysiwyg.js` | TipTap editor init & lifecycle |
| `markdown_os/static/js/wysiwyg-toolbar.js` | Formatting toolbar |
| `tests/fixtures/round-trip.md` | Markdown round-trip test fixture |

### Modified Files

| File | Changes |
|------|---------|
| `markdown_os/static/index.html` | Remove textarea + preview sections, remove Edit/Preview tabs, add WYSIWYG container + toolbar + bundle script, remove Marked.js CDN |
| `markdown_os/static/js/editor.js` | Major rewrite: TipTap API instead of textarea, remove tab switching, adapt autosave/conflict/external-change handling |
| `markdown_os/static/js/toc.js` | Simplify: read headings from WYSIWYG DOM only, single scroll sync |
| `markdown_os/static/js/tabs.js` | Replace textarea refs with TipTap API, remove isEditMode |
| `markdown_os/static/js/theme.js` | Minor: ensure theme events trigger Mermaid re-render in NodeViews |
| `markdown_os/static/css/styles.css` | Add `.ProseMirror` rules, toolbar styles, edit overlay styles, remove textarea/preview-toggle styles |
| `.gitignore` | Add `frontend/node_modules/` |
| `CLAUDE.md` | Add frontend build instructions |

### Removed Files

| File | Reason |
|------|--------|
| `markdown_os/static/js/markdown.js` | Replaced by TipTap's native rendering + custom NodeViews |

### Unchanged

| File | Reason |
|------|--------|
| `markdown_os/server.py` | Backend API unchanged (still markdown strings) |
| `markdown_os/file_handler.py` | File I/O unchanged |
| `markdown_os/cli.py` | CLI unchanged |
| `markdown_os/static/js/websocket.js` | WebSocket unchanged |
| `markdown_os/static/js/file-tree.js` | File tree unchanged |
| All `tests/test_*.py` | Backend tests remain valid |

---

## Verification & Testing

1. **Round-trip test**: Load fixture markdown → TipTap → serialize → compare structural equivalence
2. **Manual checklist per phase**:
   - Type text, verify formatting renders inline
   - All toolbar buttons produce correct output
   - Ctrl+B/I/K shortcuts work
   - Mermaid/KaTeX/code blocks render and click-to-edit works
   - Image paste/drop uploads and inserts
   - Task list checkboxes toggle and save
   - TOC generates and click-to-scroll works
   - All 6 themes render correctly
   - External file change reloads content
   - Autosave fires after 1s
   - Conflict detection works
   - Multi-file tabs (folder mode) work
   - Large files (500+ lines) perform acceptably
3. **Existing pytest suite**: `uv run pytest` — all backend tests should still pass (no backend changes)
4. **Optional**: Playwright browser tests for automated E2E verification
