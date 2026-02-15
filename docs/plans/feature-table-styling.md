# Feature Plan: Table Styling

**Status:** Draft
**Created:** 2026-02-15
**Author:** Claude (via feature-planner skill)

---

## Overview

Add professional CSS styling for markdown tables in Preview mode, including borders, padding, header highlighting, and alternating row colors (zebra-striping) with full light/dark theme support.

**Includes:**
- Complete table styling via CSS only (no JS changes needed)
- Theme-aware colors using existing CSS custom properties
- Column alignment support (left, center, right)
- Responsive horizontal scrolling for wide tables

### Key Features
- **Borders and padding**: Clean cell borders with comfortable spacing
- **Header styling**: Visually distinct header row with background color and bold text
- **Zebra-striping**: Alternating row backgrounds for improved readability
- **Theme support**: Automatic light/dark adaptation via CSS variables
- **Alignment**: Proper rendering of Marked.js alignment attributes (`:---`, `:---:`, `---:`)

---

## User Story / Value Proposition

**Problem:** Tables rendered by Marked.js currently have zero custom styling — only browser defaults. This means no borders, no padding, no header distinction, and no visual separation between rows. Tables look unprofessional and are hard to scan, especially with many rows or columns.

**User benefit:** Documentation authors, developers, and note-takers get readable, attractive tables that match modern documentation standards (GitHub, Notion, Confluence). Tables become a practical tool for organizing data rather than an eyesore.

**Use cases:**
1. **Feature status tracking** — tables listing features with status columns become scannable at a glance
2. **API documentation** — parameter tables with type, description, and default columns are easy to read
3. **Comparison tables** — side-by-side comparisons with clear row boundaries
4. **Data-heavy notes** — meeting notes, specs, and reports with tabular data look professional

---

## Current Behavior

1. Marked.js parses GFM table syntax into standard HTML: `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`
2. Marked.js applies `style="text-align:left|center|right"` attributes to `<th>` and `<td>` elements based on column alignment markers (`:---`, `:---:`, `---:`)
3. Tables render inside `#markdown-preview` (max-width 900px, centered)
4. **No CSS rules exist for table elements** in `styles.css` (confirmed: zero matches for `table`, `th`, `td`, `thead`, `tbody`, `tr`)
5. Browser defaults provide minimal styling: no borders, no padding, no header distinction

**Current HTML output (from Marked.js):**
```html
<table>
  <thead>
    <tr>
      <th style="text-align:left">Feature</th>
      <th style="text-align:center">Status</th>
      <th style="text-align:right">Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:left">Live preview</td>
      <td style="text-align:center">Enabled</td>
      <td style="text-align:right">Updates while typing</td>
    </tr>
  </tbody>
</table>
```

---

## Proposed Behavior

1. Tables display with clean 1px borders on all cells
2. Header row (`<thead>`) has a distinct background color and bold text
3. Body rows alternate between two subtle background colors (zebra-striping)
4. Cells have comfortable padding for readability
5. Column alignment (left/center/right) renders correctly via Marked.js inline styles (already works, no changes needed)
6. Tables that exceed the preview container width scroll horizontally
7. All colors adapt automatically when switching between light and dark themes
8. Hover state on rows provides subtle feedback

**Visual mockup:**
```
┌──────────────────────────────────────────────────┐
│  Feature        │    Status    │          Notes   │  ← Header (bold, accent bg)
├──────────────────────────────────────────────────┤
│  Live preview   │   Enabled    │ Updates while... │  ← Even row (panel bg)
│  Auto-save      │   Enabled    │ Debounced to...  │  ← Odd row  (subtle alt bg)
│  Mermaid        │   Enabled    │ Rendered in...   │  ← Even row (panel bg)
└──────────────────────────────────────────────────┘
```

---

## Implementation Plan

### 1. Add Table CSS Custom Properties

**File:** `markdown_os/static/css/styles.css`

**Changes:**
- Add table-specific CSS variables to `:root` (light theme) and `[data-theme="dark"]` (dark theme)

**Code Location:** After line 35 (end of modal variables in `:root`) and after line 82 (end of modal variables in `[data-theme="dark"]`)

**Light theme variables (`:root`):**
```css
--table-border: #d9dee7;
--table-header-bg: #f0f4fa;
--table-header-text: #17233b;
--table-row-alt-bg: #f7f8fa;
--table-row-hover-bg: #eef2f9;
```

**Dark theme variables (`[data-theme="dark"]`):**
```css
--table-border: #334155;
--table-header-bg: #1e3a5f;
--table-header-text: #e2e8f0;
--table-row-alt-bg: #162032;
--table-row-hover-bg: #1e3350;
```

**Rationale:** Dedicated table variables keep the design system clean and allow independent table color tuning without affecting other components. Colors are chosen to complement existing theme palettes — the header uses `--accent-soft`-adjacent tones, and the alternating row is subtle enough not to compete with content.

---

### 2. Add Table Element Styles

**File:** `markdown_os/static/css/styles.css`

**Changes:**
- Add comprehensive table styles scoped to `#markdown-preview table`

**Code Location:** After line 363 (after `#markdown-preview pre` styles), before `.code-block` styles (line 378)

**CSS rules to add:**

```css
/* ── Table Styling ── */

#markdown-preview table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0 20px;
  font-size: 15px;
  display: block;
  overflow-x: auto;
}

#markdown-preview thead {
  display: table-header-group;
}

#markdown-preview tbody {
  display: table-row-group;
}

#markdown-preview tr {
  display: table-row;
}

#markdown-preview th,
#markdown-preview td {
  display: table-cell;
}

#markdown-preview th {
  border: 1px solid var(--table-border);
  padding: 10px 14px;
  font-weight: 600;
  background: var(--table-header-bg);
  color: var(--table-header-text);
  white-space: nowrap;
}

#markdown-preview td {
  border: 1px solid var(--table-border);
  padding: 9px 14px;
}

#markdown-preview tbody tr:nth-child(even) {
  background: var(--table-row-alt-bg);
}

#markdown-preview tbody tr:hover {
  background: var(--table-row-hover-bg);
}
```

**Rationale:**
- `border-collapse: collapse` — standard for clean table borders
- `display: block` on `<table>` + `overflow-x: auto` — enables horizontal scrolling for wide tables while keeping the table behaving normally internally (child elements explicitly set back to `table-*` display)
- `white-space: nowrap` on `<th>` — prevents header text from wrapping, keeping columns clean
- `nth-child(even)` — zebra-striping on even rows (header excluded since it's in `<thead>`)
- Row hover — subtle interactive feedback for scanning rows
- Padding values (10px/14px) match the editor's spacing language

---

## Edge Cases to Handle

#### Case 1: Wide tables exceeding container width
- **Scenario:** Table has many columns or long cell content pushing beyond 900px max-width
- **Expected behavior:** Horizontal scrollbar appears, table scrolls independently
- **Implementation note:** `display: block` + `overflow-x: auto` on `#markdown-preview table` handles this. Internal elements use `display: table-*` to preserve table layout.

#### Case 2: Single-column table
- **Scenario:** User creates a table with only one column
- **Expected behavior:** Table takes full width, styling applies normally
- **Implementation note:** `width: 100%` handles this naturally

#### Case 3: Empty cells
- **Scenario:** Table cell has no content (`| | value |`)
- **Expected behavior:** Cell renders with borders and padding but no content — visually consistent
- **Implementation note:** Padding ensures empty cells have proper height. No special handling needed.

#### Case 4: Inline formatting in cells
- **Scenario:** Cells contain bold, italic, code, or links (`**bold**`, `*italic*`, `` `code` ``, `[link](url)`)
- **Expected behavior:** Inline formatting renders normally inside styled cells
- **Implementation note:** All inline styles are on child elements; table CSS doesn't interfere. Inline `<code>` inherits monospace font from existing `#markdown-preview code` rule.

#### Case 5: Table inside a blockquote
- **Scenario:** Table appears within `> blockquote` syntax
- **Expected behavior:** Table styling applies normally; blockquote indentation wraps the table
- **Implementation note:** CSS selectors target `#markdown-preview table` regardless of parent context.

#### Case 6: Theme switching with table visible
- **Scenario:** User toggles between light and dark theme while viewing a table
- **Expected behavior:** Table colors transition smoothly (borders, backgrounds, text)
- **Implementation note:** All table colors use CSS variables that swap on theme change. The global `transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease` rule (line 99-102) already covers these properties.

#### Case 7: Very long cell content
- **Scenario:** A cell contains a paragraph-length string
- **Expected behavior:** Cell wraps text normally; `<td>` allows wrapping (only `<th>` has `nowrap`)
- **Implementation note:** `white-space: nowrap` is only on `<th>`. Body cells wrap by default.

#### Case 8: Multiple tables in one document
- **Scenario:** Document contains several tables throughout
- **Expected behavior:** Each table is independently styled with consistent spacing
- **Implementation note:** `margin: 16px 0 20px` on each table provides consistent vertical rhythm.

---

## Testing Strategy

### Manual Tests

**Basic Styling:**
1. Open `example.md` (has 3 tables) → all tables should have borders, padding, header bg, and zebra-striping
2. Check simple table → header row has distinct background, bold text
3. Check alignment table → left/center/right alignment works correctly
4. Check formatting table → bold, italic, code, and links render inside cells

**Theme Support:**
5. View tables in light theme → borders and backgrounds match light palette
6. Switch to dark theme → all table colors update smoothly
7. Switch back to light → colors revert correctly

**Zebra-Striping:**
8. Table with 1 row → no striping visible (only 1 body row)
9. Table with 5+ rows → alternating backgrounds clearly visible
10. Hover over rows → subtle highlight appears

**Responsive Behavior:**
11. Create a table with 10+ columns → horizontal scrollbar appears
12. Scroll horizontally → header row and content scroll together
13. Narrow viewport (< 600px) → table scrolls, no layout breakage

**Edge Cases:**
14. Empty cells → cell borders and height maintained
15. Single-column table → full width, styled normally
16. Table inside blockquote → styled correctly with blockquote indent
17. Very long cell content → text wraps in body cells, no overflow

---

## Files to Modify

| File | Changes |
|------|---------|
| `markdown_os/static/css/styles.css` | • Add table CSS variables to `:root` (light theme)<br>• Add table CSS variables to `[data-theme="dark"]` (dark theme)<br>• Add table element styles (`table`, `th`, `td`, `tr`, `thead`, `tbody`)<br>• Add zebra-striping and hover styles |

---

## Decisions / Open Questions

### Q1: Should table styling be CSS-only or require JavaScript? ✅
**Options:**
- **Option A**: CSS-only — add styles to `styles.css`, no JS changes
- **Option B**: JavaScript — wrap tables in containers, add classes via `markdown.js`

**Decision:** Option A selected. Marked.js already generates semantic HTML (`<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`) with alignment inline styles. CSS-only styling is simpler, more maintainable, and covers all requirements without modifying the rendering pipeline.

### Q2: How should wide tables handle overflow? ✅
**Options:**
- **Option A**: Horizontal scroll on the table element itself
- **Option B**: Wrap each table in a scrollable container div (requires JS)
- **Option C**: Allow tables to break out of the max-width container

**Decision:** Option A selected. Using `display: block` + `overflow-x: auto` on the table element enables horizontal scrolling without any JavaScript wrapper divs. Child elements are explicitly set back to `table-*` display values to preserve table layout. This is a common pattern used by GitHub and documentation sites.

### Q3: Should header cells allow text wrapping? ✅
**Options:**
- **Option A**: `white-space: nowrap` — headers stay on one line
- **Option B**: Allow wrapping — headers can span multiple lines

**Decision:** Option A selected. Headers are typically short labels. Preventing wrapping keeps columns clean and predictable. Body cells allow normal wrapping for longer content.

### Q4: Should rows have a hover effect? ✅
**Options:**
- **Option A**: Yes — subtle background change on hover for row scanning
- **Option B**: No — static appearance only

**Decision:** Option A selected. Row hover is a standard UX pattern for data tables that helps users track across columns. The effect is subtle enough not to be distracting.

---

## Implementation Checklist

### Phase 1: CSS Variables
- [ ] Add table CSS variables to `:root` block (light theme)
- [ ] Add table CSS variables to `[data-theme="dark"]` block (dark theme)

### Phase 2: Table Styles
- [ ] Add `#markdown-preview table` base styles (width, collapse, margin, overflow)
- [ ] Add display reset rules for `thead`, `tbody`, `tr`, `th`, `td`
- [ ] Add `#markdown-preview th` styles (border, padding, font-weight, background)
- [ ] Add `#markdown-preview td` styles (border, padding)
- [ ] Add zebra-striping (`tbody tr:nth-child(even)`)
- [ ] Add row hover effect (`tbody tr:hover`)

### Phase 3: Testing & Polish
- [ ] Test with `example.md` tables (simple, alignment, formatting)
- [ ] Test light theme appearance
- [ ] Test dark theme appearance
- [ ] Test theme switching transition
- [ ] Test horizontal scrolling with wide table
- [ ] Verify column alignment (left, center, right) works
- [ ] Verify inline formatting (bold, italic, code, links) in cells
- [ ] Test on narrow viewport

---

## Success Criteria

### Core Functionality
✅ All tables in Preview mode have borders, padding, and visual structure
✅ Header row is visually distinct (background + bold text)
✅ Body rows have alternating backgrounds (zebra-striping)
✅ Column alignment (left/center/right) renders correctly

### Theme Support
✅ Tables look polished in light theme
✅ Tables look polished in dark theme
✅ Theme switching transitions smoothly (no flash)

### Responsive
✅ Wide tables scroll horizontally without breaking layout
✅ Tables display correctly on narrow viewports

### UX
✅ Row hover provides subtle interactive feedback
✅ Tables are easy to scan and read
✅ Empty cells maintain proper visual structure

### Code Quality
✅ CSS-only implementation — no JavaScript changes required
✅ Uses CSS custom properties consistent with existing design system
✅ Styles are scoped to `#markdown-preview` to avoid side effects
