# Feature Plan: Multi-Theme Support

## Summary

Replace the current light/dark toggle with a daisyUI-style dropdown theme selector supporting 7 themes. The dropdown button shows colored dots representing the active theme and expands to a scrollable list of all available themes on click. On first visit (no stored preference), the app auto-selects Default Light or Default Dark based on the OS `prefers-color-scheme` setting.

## Theme List

| Theme         | Type  | Description                                           |
|---------------|-------|-------------------------------------------------------|
| Default Light | light | Current light theme (renamed)                         |
| Default Dark  | dark  | Current dark theme (renamed, blueish slate palette)   |
| Dracula       | dark  | Classic Dracula palette (purple/pink/green accents)    |
| Nord Light    | light | Light variant of Nord palette (snow + frost colors)    |
| Nord Dark     | dark  | Dark variant of Nord palette (polar night + frost)     |
| Lofi          | light | Minimal grayscale, low-contrast, distraction-free      |

On first visit (no stored preference), the app auto-selects **Default Light** or **Default Dark** based on the OS `prefers-color-scheme` setting. There is no explicit "Auto" option in the UI.

## UI Design
Based on the following screenshot

![image](images/image-20260218-112339-540416.png)

### Dropdown Button (closed state)
- Replaces the current sun/moon toggle in the `tab-controls` area (top-right of the header)
- Small compact button showing:
  - 3-4 small colored dots on a mini rectangular background representing the active theme's key colors (bg, text, accent)
  - A small downward chevron indicator
- Same size/spacing as the current toggle button to maintain header layout

### Dropdown Panel (open state)
- Opens below the button, aligned to the right edge
- Max height with vertical scroll if needed
- Each row contains:
  - The same colored-dot swatch (bg + text + accent colors as small circles)
  - Theme name label
- The currently active theme row is visually highlighted (accent background + checkmark icon) so the user can immediately see which theme is selected
- Clicking outside or pressing Escape closes the dropdown
- Clicking a theme applies it immediately (live preview on hover is optional/deferred)

## CSS Variable Architecture

### Current State
- `:root` defines all light theme variables (~65 CSS custom properties)
- `[data-theme="dark"]` overrides all variables for dark mode
- Variables cover: layout colors, editor, tabs, code blocks, modals, tables, mermaid, math

### New State
- `:root` remains the base (Default Light)
- Each theme gets its own `[data-theme="<name>"]` selector block overriding all variables
- Theme names stored as `data-theme` attribute values: `light`, `dark`, `dracula`, `nord-light`, `nord-dark`, `lofi`

### File Organization
Theme variable definitions should be extracted to a dedicated file to avoid bloating `styles.css`:
- **`css/themes.css`** - All `[data-theme="..."]` variable blocks (new file)
- **`css/styles.css`** - `:root` (Default Light base) stays here; remove `[data-theme="dark"]` block and move it to `themes.css`
- `index.html` loads `themes.css` after `styles.css`

### Theme Color Palettes

Each theme must define the full set of ~65 CSS custom properties. Key representative colors for each:

**Default Light** (existing `:root`):
- bg: `#f7f8fa`, panel: `#ffffff`, text: `#17233b`, accent: `#2563eb`

**Default Dark** (existing `[data-theme="dark"]`):
- bg: `#0f172a`, panel: `#1e293b`, text: `#e2e8f0`, accent: `#60a5fa`

**Dracula**:
- bg: `#282a36`, panel: `#44475a`, text: `#f8f8f2`, accent: `#bd93f9`
- Additional Dracula palette: pink `#ff79c6`, green `#50fa7b`, cyan `#8be9fd`, orange `#ffb86c`

**Nord Light**:
- bg: `#eceff4`, panel: `#e5e9f0`, text: `#2e3440`, accent: `#5e81ac`
- Nord snow whites: `#d8dee9`, `#e5e9f0`; frost: `#88c0d0`; aurora accents: green `#a3be8c`, orange `#d08770`

**Nord Dark**:
- bg: `#2e3440`, panel: `#3b4252`, text: `#eceff4`, accent: `#88c0d0`
- Nord frost blues: `#5e81ac`, `#81a1c1`; aurora accents: green `#a3be8c`, orange `#d08770`

**Lofi**:
- bg: `#f5f5f5`, panel: `#ffffff`, text: `#333333`, accent: `#555555`
- Minimal palette: borders `#d0d0d0`, muted text `#888888`, very low saturation throughout

## JavaScript Changes

### `theme.js` Refactor

**Theme Registry:**
```
THEMES = [
  { id: "light",      name: "Default Light",  type: "light", dots: ["#f7f8fa", "#17233b", "#2563eb"] },
  { id: "dark",       name: "Default Dark",   type: "dark",  dots: ["#0f172a", "#e2e8f0", "#60a5fa"] },
  { id: "dracula",    name: "Dracula",         type: "dark",  dots: ["#282a36", "#f8f8f2", "#bd93f9"] },
  { id: "nord-light", name: "Nord Light",      type: "light", dots: ["#eceff4", "#2e3440", "#5e81ac"] },
  { id: "nord-dark",  name: "Nord Dark",       type: "dark",  dots: ["#2e3440", "#eceff4", "#88c0d0"] },
  { id: "lofi",       name: "Lofi",            type: "light", dots: ["#f5f5f5", "#333333", "#555555"] },
]
```

Each theme entry also specifies its `highlightTheme` (highlight.js stylesheet name) and `mermaidTheme`.

**Highlight.js Mapping:**

| Theme         | highlight.js style            |
|---------------|-------------------------------|
| Default Light | `github`                      |
| Default Dark  | `github-dark`                 |
| Dracula       | `dracula`                     |
| Nord Light    | `nord`                        |
| Nord Dark     | `nord`                        |
| Lofi          | `grayscale` or `github`       |

Instead of toggling between two pre-loaded `<link>` tags, switch to dynamically setting the `href` on a single `<link id="highlight-theme">` element. This avoids loading all stylesheets upfront.

**Mermaid Theme Mapping:**

| Theme         | Mermaid theme  |
|---------------|----------------|
| Default Light | `default`      |
| Default Dark  | `dark`         |
| Dracula       | `dark`         |
| Nord Light    | `neutral`      |
| Nord Dark     | `dark`         |
| Lofi          | `neutral`      |

**First-Visit / No Stored Theme Logic:**
- On first visit (no value in `localStorage`), detect OS `prefers-color-scheme` and auto-select `light` or `dark`
- Persist this resolved choice to `localStorage` immediately so subsequent loads are instant
- No "Auto" option is exposed in the dropdown UI; the system preference is only used for the initial default

**ThemeManager Changes:**
- Replace `toggleTheme()` with `selectTheme(themeId)`
- `applyTheme()` now handles any theme ID (not just light/dark binary)
- `normalizeTheme()` removed (no longer binary)
- Add methods for dropdown UI: `openDropdown()`, `closeDropdown()`, `renderDropdown()`

### Flash-of-wrong-theme prevention (`index.html` inline script)
The existing inline `<script>` in `<head>` that sets `data-theme` before paint needs updating:
- Read stored theme from localStorage (can now be any valid theme ID)
- If absent or unrecognized, resolve to `"light"` or `"dark"` via `matchMedia`
- Set `data-theme` to the stored/resolved value

## HTML Changes

### Remove
- Sun SVG icon (`#theme-icon-sun`)
- Moon SVG icon (`#theme-icon-moon`)
- Current `#theme-toggle` button

### Add
Replace with a dropdown structure:
```html
<div class="theme-dropdown" id="theme-dropdown">
  <button class="theme-dropdown-toggle" id="theme-dropdown-toggle"
          type="button" aria-label="Select theme" aria-haspopup="listbox"
          aria-expanded="false">
    <span class="theme-dots" id="theme-dots">
      <!-- 3 small colored circles rendered by JS -->
    </span>
    <svg class="dropdown-chevron" ...><!-- chevron down --></svg>
  </button>
  <ul class="theme-dropdown-menu" id="theme-dropdown-menu"
      role="listbox" aria-label="Theme selection" hidden>
    <!-- Rows rendered by JS from THEMES registry -->
  </ul>
</div>
```

## CSS Changes (for dropdown UI)

### `.theme-dropdown`
- `position: relative` for anchoring the menu
- Fits within the existing `tab-controls` flex layout

### `.theme-dropdown-toggle`
- Matches existing button styling (size, padding, border, hover state)
- Flex layout: dots + chevron
- Chevron rotates 180deg when open

### `.theme-dots`
- 3 small circles (8-10px) in a row with 3px gap
- Each circle is a `<span>` with `background-color` and `border-radius: 50%`

### `.theme-dropdown-menu`
- `position: absolute; top: 100%; right: 0`
- Background: `var(--panel-bg)`, border: `var(--border)`, shadow: `var(--shadow)`
- `max-height: 300px; overflow-y: auto`
- `min-width: 180px`
- `z-index: 100`
- Subtle open/close animation (opacity + translateY)

### `.theme-dropdown-item`
- Flex row: dots swatch + theme name + checkmark area
- Hover: subtle highlighted background (`var(--accent-soft)` or similar)
- `cursor: pointer`

### `.theme-dropdown-item.active` (currently selected theme)
- Background: `var(--accent-soft)` persistent highlight (not just on hover)
- Text color: `var(--accent)` for the theme name
- Checkmark icon visible on the right side of the row (hidden for non-active items)
- The active state must be visually distinct even without hover, so the user immediately sees which theme is selected when opening the dropdown

## Implementation Steps

### Phase 1: CSS Theme Definitions
1. Create `css/themes.css` file
2. Move `[data-theme="dark"]` block from `styles.css` to `themes.css`
3. Add `[data-theme="dracula"]`, `[data-theme="nord-light"]`, `[data-theme="nord-dark"]`, `[data-theme="lofi"]` variable blocks to `themes.css`
4. Add `<link>` for `themes.css` in `index.html` after `styles.css`
5. Visually verify each theme renders correctly with all UI elements

### Phase 2: Dropdown UI (HTML + CSS)
1. Replace the sun/moon toggle button markup in `index.html` with the dropdown structure
2. Add dropdown CSS to `styles.css` (toggle button, menu, items, dots)
3. Ensure the dropdown is keyboard accessible (arrow keys, Escape, Enter)
4. Ensure the dropdown is responsive and doesn't overflow the viewport

### Phase 3: JavaScript ThemeManager Refactor
1. Add the THEMES registry with all metadata (id, name, type, dots, highlightTheme, mermaidTheme)
2. Refactor `ThemeManager` to support multi-theme selection
3. Implement dropdown rendering and interaction logic
4. Update `applyTheme()` to handle all theme IDs
5. Switch highlight.js from dual `<link>` toggle to single dynamic `<link href>` swap
6. Update Mermaid theme dispatch with per-theme mapping
7. Update the inline `<head>` script for flash prevention (support all theme IDs, fall back to OS preference on first visit)

### Phase 4: Testing & Polish
1. Test all 7 themes across all UI states (editor, preview, modals, code blocks, tables, mermaid, math)
2. Test first-visit behavior (no localStorage) resolves correctly from OS preference
3. Test persistence across page reloads
4. Test dropdown keyboard navigation and screen reader accessibility
5. Test flash-of-wrong-theme prevention on page load
6. Verify smooth theme transitions (CSS transitions already on `background-color`, `color`, `border-color`)

## Edge Cases & Notes

- **Stored theme no longer exists**: If `localStorage` has an unrecognized theme ID (e.g., after removing a theme), fall back to OS preference resolution (Default Light or Default Dark).
- **Dropdown click-outside**: Use a document-level click listener that closes the menu when clicking outside the dropdown container.
- **Multiple highlights loading**: By switching to a single `<link>` with dynamic `href`, only one highlight.js stylesheet is ever loaded. There may be a brief FOUC for code blocks on theme switch; this is acceptable.
- **Mermaid re-render cost**: Mermaid diagrams must be fully re-rendered on theme change (not just CSS). This is already handled by the existing `markdown-os:theme-changed` event.
- **Transition smoothness**: The existing `transition: background-color 0.2s, color 0.2s, border-color 0.2s` on `*` ensures smooth switching. No changes needed.

