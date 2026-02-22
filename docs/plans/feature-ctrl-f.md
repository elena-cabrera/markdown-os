# Feature Plan: Ctrl+F Search Bar

## Context

Users currently have no in-app way to search within the document they're editing. Pressing Ctrl/Cmd+F triggers the browser's native find dialog, which doesn't integrate with the editor's theming or UX. This feature adds a Notion-inspired search bar that floats in the top-right of the content area, with match highlighting and keyboard navigation. No replace functionality — find only.

## Files to Modify

| File | Action |
|------|--------|
| `markdown_os/static/js/search.js` | **Create** — self-contained search module (IIFE, exposes `window.markdownSearch`) |
| `markdown_os/static/index.html` | **Edit** — add search bar HTML inside `.view-area` + `<script>` tag |
| `markdown_os/static/css/styles.css` | **Edit** — add search bar styles + `::highlight()` pseudo-element styles |

No backend changes needed. No changes to `wysiwyg.js`, `editor.js`, or other existing JS files.

## Key Design Decision: CSS Custom Highlight API

Use the [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) for match highlighting. This is critical because:

- **Does NOT modify the DOM** — creates `Range` objects styled via `::highlight()` CSS pseudo-elements
- Won't corrupt the contenteditable undo/redo stack
- Won't trigger `input` events / spurious autosaves
- Won't break Turndown markdown serialization (no cleanup needed in `cleanupForSerialization`)
- Browser support: Chrome 105+, Safari 17.2+, Firefox 140+ (fine for a dev-focused local tool)
- Graceful degradation: if `CSS.highlights` is unavailable, search still works but without visual highlighting

## Implementation Details

### 1. HTML — Search bar markup (inside `.view-area`, before `#floating-toolbar`)

```html
<div id="search-bar" class="search-bar hidden" role="search" aria-label="Find in document">
  <input type="text" id="search-input" class="search-bar-input"
    placeholder="Find..." autocomplete="off" spellcheck="false" />
  <span id="search-match-count" class="search-match-count" aria-live="polite"></span>
  <button id="search-prev-btn" class="search-nav-btn" title="Previous (Shift+Enter)">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 5.5V19m6-8s-4.419-6-6-6s-6 6-6 6"/></svg>
  </button>
  <button id="search-next-btn" class="search-nav-btn" title="Next (Enter)">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18.502v-13.5m6 8s-4.419 6-6 6s-6-6-6-6"/></svg>
  </button>
  <button id="search-close-btn" class="search-close-btn" title="Close (Esc)">&#x2715;</button>
</div>
```

Script tag for `search.js` loads after `wysiwyg-toolbar.js`, before `toc.js`.

### 2. CSS — Styles added to `styles.css`

- `.search-bar` — `position: absolute; top: 12px; right: 16px; z-index: 30;` (above floating toolbar z:20, below dropdown z:100)
- Uses existing CSS vars: `--panel-bg`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-soft`, `--editor-bg`, `--shadow`
- Input follows `.file-tree-search` pattern (border, radius, focus state)
- Nav buttons follow existing small button patterns (28px square, hover accent)
- Fade-in animation (0.15s, translateY(-4px) to 0)
- `::highlight(search-all)` — `background: var(--accent-soft)` (all matches)
- `::highlight(search-current)` — `background: var(--accent); color: #fff` (active match)
- Responsive: narrower input on mobile (`@media max-width: 980px`)

### 3. JavaScript — `search.js` module

**State:**
```
isOpen, query, matches (Range[]), currentIndex, debounceTimer,
highlightAll (Highlight), highlightCurrent (Highlight), changeUnsubscribe
```

**Core functions:**
- `getSearchableTextNodes()` — TreeWalker over `#wysiwyg-editor`, collects all text nodes (including inside code blocks, math, mermaid)
- `findMatches(query)` — case-insensitive literal search using escaped regex, returns array of Range objects
- `applyHighlights()` — registers `Highlight` instances with `CSS.highlights` (priority 1 for all, priority 2 for current)
- `clearHighlights()` — deletes both highlight registrations
- `scrollToCurrentMatch()` — calculates position relative to `#editor-container` scroll, smooth-scrolls to center match
- `goToNext()` / `goToPrevious()` — wrapping navigation with counter update
- `executeSearch(query)` — find + highlight + scroll to first match
- `onSearchInput()` — debounced (150ms) trigger for executeSearch
- `onEditorContentChanged()` — re-runs search when content changes while search is open (subscribed via `window.wysiwyg.onChange`)

**Open/Close:**
- `open()` — remove `.hidden`, focus input, select existing text, subscribe to editor changes
- `close()` — add `.hidden`, clear state + highlights, unsubscribe, restore focus to editor via `window.wysiwyg.focus()`

**Keyboard handling:**
- Global `keydown`: Ctrl/Cmd+F → `open()` with `preventDefault()` (blocks browser find)
- Global `keydown`: Escape → `close()` (only if search is open AND no modal is open)
- Search input `keydown`: Enter → `goToNext()`, Shift+Enter → `goToPrevious()`
- Click-outside: `pointerdown` listener closes search if target is outside `#search-bar`

**Reused APIs (no changes needed):**
- `window.wysiwyg.onChange(callback)` — subscribe to content changes (`wysiwyg.js:2059`)
- `window.wysiwyg.focus()` — restore focus after close (`wysiwyg.js:2067`)

### 4. Arrow Icons

Hugeicons `arrow-up-02` and `arrow-down-02` (stroke rounded) inline SVGs — already included in the HTML markup above. SVG `viewBox="0 0 24 24"`, sized via CSS (`.search-nav-btn svg { width: 14px; height: 14px; }`).

## UX Decisions

- **Case sensitivity**: Always case-insensitive (no toggle)
- **No replace**: Find-only, no replace functionality
- **Icons**: Hugeicons `arrow-up-02` / `arrow-down-02` (stroke rounded) — SVGs provided, used inline
- **Scope**: Works in the WYSIWYG editor (the only mode — no separate edit/preview distinction)

## Edge Cases

- **Special characters in query**: regex-escaped before matching (`.*+?^${}()|[]\`)
- **Matches inside code blocks / math / mermaid**: TreeWalker traverses all text nodes including `contenteditable="false"` regions — intentional, users expect Ctrl+F to find everywhere
- **Content changes while searching**: `onChange` re-runs search, clamps currentIndex to new match count
- **Range invalidation on DOM mutation**: `onEditorContentChanged` re-creates all ranges from scratch
- **Escape priority**: search yields to open modals (checks `.modal:not(.hidden)`)
- **No matches**: counter shows "0 results", no highlights
- **Empty query**: counter empty, no highlights
- **Cross-node matches** (e.g. "bold text" split across `<strong>` boundary): won't match — same behavior as Notion, acceptable for V1

## Verification

1. `uv run markdown-os example --open` to launch with example content
2. Press Cmd/Ctrl+F — search bar appears top-right, input focused
3. Type text — matches highlight (accent-soft), first match highlighted differently (accent)
4. Counter shows "1 of N"
5. Enter / click down arrow → next match, scrolls into view
6. Shift+Enter / click up arrow → previous match
7. Press Escape / click X / click outside → bar closes, highlights cleared
8. Switch themes while search is open → highlights adapt
9. Edit content while search is open → matches update
10. Search for special chars like `$`, `*`, `(` → works correctly
11. Test across all 6 themes (light, dark, dracula, nord-light, nord-dark, lofi)
12. Run `uv run pytest` — existing tests still pass
