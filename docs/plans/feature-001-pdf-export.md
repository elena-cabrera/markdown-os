# Feature Plan: PDF Export

## Goal

Add an "Export to PDF" button to the top-right toolbar that downloads the rendered content area as a PDF file, without triggering a print dialog.

---

## UI Changes

### Move save-status

`#save-status` currently lives inside `.tab-controls` (right side of `.tab-nav`). Move it to sit immediately after the `.undo-redo-group` on the left, so it reads:

```text
[ ↩ ] [ ↪ ]  Saved   ···file.md···   [Theme▾] [Export]

```

In `index.html`, remove `<span id="save-status">` from `.tab-controls` and place it directly after the closing `</div>` of `.undo-redo-group`, as a sibling element inside `.tab-nav`. Because `.tab-nav` uses a 3-column grid (`auto 1fr auto`), adding a fourth child breaks the grid — wrap undo-redo + save-status together in a new `<div class="nav-left-group">` that takes the first `auto` column.

```html
<div class="nav-left-group">
  <div class="undo-redo-group" aria-label="Edit history controls">
    <!-- undo / redo buttons unchanged -->
  </div>
  <span id="save-status" aria-live="polite">Idle</span>
</div>

```

Update `.tab-nav` grid to remain `grid-template-columns: auto 1fr auto`. `.nav-left-group` uses `display: inline-flex; align-items: center; gap: 10px;`.

### Export button

Add a button to `.tab-controls`, to the left of the theme dropdown:

```html
<button
  id="export-pdf-button"
  class="history-button"
  type="button"
  title="Export to PDF"
  aria-label="Export to PDF"
>
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">
      <path d="M20 14v-3.343c0-.818 0-1.226-.152-1.594c-.152-.367-.441-.657-1.02-1.235l-4.736-4.736c-.499-.499-.748-.748-1.058-.896a2 2 0 0 0-.197-.082C12.514 2 12.161 2 11.456 2c-3.245 0-4.868 0-5.967.886a4 4 0 0 0-.603.603C4 4.59 4 6.211 4 9.456V14c0 3.771 0 5.657 1.172 6.828S8.229 22 12 22m1-19.5V3c0 2.828 0 4.243.879 5.121C14.757 9 16.172 9 19 9h.5"/>
      <path d="M17 22c.607-.59 3-2.16 3-3s-2.393-2.41-3-3m2 3h-7"/>
    </g>
  </svg>
</button>

```

The button reuses `.history-button` class exactly (32 × 32 px, `var(--border)`, `border-radius: 8px`, hover accent) — no new CSS needed for the button itself.

---

## PDF Generation

Use **html2pdf.js** (CDN, no build step required) to convert the rendered content area to PDF client-side. This library rasterises the DOM via `html2canvas` and assembles the pages with `jsPDF`.

Add to `index.html` `<head>`:

```html
<script
  src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js"
  crossorigin="anonymous"
></script>

```

### New file: `markdown_os/static/js/pdf-export.js`

```text
window.MarkdownOS = window.MarkdownOS || {};
window.MarkdownOS.pdfExport = { exportToPdf };

```

Core logic in `exportToPdf()`:

1.  Grab `document.getElementById('wysiwyg-wrapper')` as the source element.
2.  Derive a filename from `document.title` (strip `.md` extension, append `.pdf`), falling back to `document-export.pdf`.
3.  Call `html2pdf()` with options:
    -   `margin: [10, 12, 10, 12]` (mm)
    -   `filename`: derived above
    -   `image: { type: 'jpeg', quality: 0.95 }`
    -   `html2canvas: { scale: 2, useCORS: true }`
    -   `jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }`
4.  Chain `.from(element).save()` — this triggers a direct browser download with no print dialog.

Add `<script src="/static/js/pdf-export.js"></script>` in `index.html` after the other module scripts.

### Wire up in `editor.js`

In `initEditor()` (or a `DOMContentLoaded` listener), attach:

```js
document.getElementById('export-pdf-button')
  ?.addEventListener('click', () => window.MarkdownOS.pdfExport.exportToPdf());

```

---

## Files to Change

| File | Change |
| --- | --- |
| `markdown_os/static/index.html` | Wrap undo-redo + save-status in `.nav-left-group`; add export button to `.tab-controls`; add html2pdf CDN script; add `pdf-export.js` script tag |
| `markdown_os/static/css/styles.css` | Add `.nav-left-group` flex styles (mirrors `.undo-redo-group`); no changes to `.history-button` |
| `markdown_os/static/js/pdf-export.js` | New file — `exportToPdf()` implementation |
| `markdown_os/static/js/editor.js` | Wire click listener on `#export-pdf-button` |

---

## Out of Scope

-   Server-side PDF rendering (Puppeteer, WeasyPrint)
-   Custom page headers/footers
-   Print stylesheet (`@media print`)
-   Export of multiple files at once