# Feature Plan: Focus Mode

## Goal

A keyboard-only toggle (no button) that enters real browser fullscreen, hides all chrome (sidebar, tab-nav, file-tabs bar), and leaves only the content area and floating formatting toolbar visible. Pressing ESC or the same shortcut exits.

---

## Behavior

| State | What's visible |
|-------|---------------|
| Normal | Sidebar, tab-nav, file-tabs bar, content, floating toolbar |
| Focus mode | Content area only, floating toolbar |

- **Enter**: `F11` (or `Ctrl+Shift+F` as fallback — see note below)
- **Exit**: `ESC` (native fullscreen ESC) or pressing the shortcut again
- Focus mode == browser fullscreen — triggered via `document.documentElement.requestFullscreen()` and exited via `document.exitFullscreen()`
- If the browser denies the fullscreen request (permissions policy), fall back to a CSS-only "simulated fullscreen" that stretches the container to `100vw × 100vh` with `position: fixed`

> **Note on F11:** Browsers intercept `F11` natively (Chrome/Edge toggle fullscreen, Firefox too). The shortcut should therefore be **`Ctrl+Shift+F`** to avoid conflict, with `F11` as a best-effort secondary that may or may not work depending on the browser/OS.

---

## Implementation

### New file: `markdown_os/static/js/focus-mode.js`

Encapsulated as a module IIFE, exposing `window.MarkdownOS.focusMode = { toggle, isActive }`.

```
State:
  isFocusMode = false

toggle():
  if isFocusMode → exit
  else → enter

enter():
  requestFullscreen on documentElement (catch and fallback to CSS mode)
  document.body.classList.add('focus-mode')
  isFocusMode = true

exit():
  if document.fullscreenElement → exitFullscreen()
  document.body.classList.remove('focus-mode')
  isFocusMode = false
```

Listen on `document` for `fullscreenchange` — if the browser exits fullscreen natively (via ESC or clicking away), call `exit()` to sync state and remove the CSS class.

### CSS — `styles.css`

```css
/* Focus mode: hide everything except the content and floating toolbar */
body.focus-mode #sidebar,
body.focus-mode .tab-nav,
body.focus-mode #file-tabs-bar {
  display: none !important;
}

body.focus-mode #main-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

body.focus-mode .view-area {
  flex: 1;
  overflow-y: auto;
}

/* CSS-only fullscreen fallback (when requestFullscreen is denied) */
body.focus-mode-css-fallback {
  position: fixed;
  inset: 0;
  z-index: 10000;
  overflow: hidden;
}
```

The floating toolbar (`#floating-toolbar`) remains visible because it is inside `.view-area`, which is not hidden.

### Keyboard shortcut — `editor.js`

Register inside `initEditor()` (or in a `DOMContentLoaded` block):

```js
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+F
  if (e.ctrlKey && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    window.MarkdownOS.focusMode.toggle();
  }
  // F11 (best-effort — may be intercepted by browser)
  if (e.key === 'F11') {
    e.preventDefault();
    window.MarkdownOS.focusMode.toggle();
  }
});
```

### Add script tag — `index.html`

```html
<script src="/static/js/focus-mode.js"></script>
```

Place it before `editor.js`.

---

## Files to Change

| File | Change |
|------|--------|
| `markdown_os/static/js/focus-mode.js` | New file — `toggle()`, `enter()`, `exit()`, fullscreen API + CSS fallback |
| `markdown_os/static/css/styles.css` | Add `body.focus-mode` rules to hide sidebar / tab-nav / tabs |
| `markdown_os/static/js/editor.js` | Register `keydown` listener for `Ctrl+Shift+F` and `F11` |
| `markdown_os/static/index.html` | Add `focus-mode.js` script tag |

---

## Out of Scope

- A visible button or indicator showing focus mode is active
- Saving focus mode state across page reloads
- Per-file focus mode (always applies to the active document)
- Custom shortcut configuration
