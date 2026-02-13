# Plan: Dark Mode Theme

## Overview

Add dark mode theme support with automatic system preference detection and manual toggle override. The feature provides a seamless theme-switching experience that reduces eye strain for users working in low-light environments.

**Includes**: Light/dark color schemes, theme toggle button, system preference detection, localStorage persistence, and syntax highlighting theme switching

### Key Features
- **Automatic theme detection**: Respects OS-level dark mode preference (`prefers-color-scheme`)
- **Manual override**: Toggle button in top-right header for explicit theme control
- **Persistent preference**: Theme choice saved to localStorage and restored on page load
- **Comprehensive theming**: All UI elements, code blocks, and syntax highlighting adapt to theme
- **Smooth transitions**: CSS transitions for comfortable theme switching

---

## Current Behavior

1. **Light theme only**: Editor uses a fixed light color scheme defined in `:root` CSS variables
2. **CSS variables in place**: Colors already use CSS custom properties (`--bg`, `--panel-bg`, `--text`, etc.)
3. **Hardcoded colors**: Some elements have hardcoded hex colors (e.g., `#111827`, `#ffffff`) not tied to variables
4. **GitHub syntax theme**: highlight.js uses only the light "github" theme for code syntax highlighting
5. **No persistence**: No theme preference storage mechanism exists

**Files involved**:
- `markdown_os/static/css/styles.css`: Color definitions and styling
- `markdown_os/static/index.html`: HTML structure and highlight.js CDN link
- `markdown_os/static/js/editor.js`, `markdown.js`, `toc.js`, `websocket.js`: Frontend logic

---

## Proposed Behavior

1. **On initial page load**:
   - Check localStorage for saved theme preference (`theme: 'light' | 'dark'`)
   - If no preference, detect system preference using `window.matchMedia('(prefers-color-scheme: dark)')`
   - Apply the determined theme immediately (before content renders to prevent flash)

2. **Theme toggle interaction**:
   - User clicks sun/moon icon button in top-right header (next to save status)
   - Theme switches between light and dark with smooth CSS transition
   - New preference saved to localStorage
   - System preference listener remains active but localStorage takes precedence

3. **System preference changes**:
   - If user has NOT manually selected a theme, editor respects OS theme changes in real-time
   - If user HAS manually selected, localStorage preference overrides system changes

4. **Visual changes**:
   - Background, text, borders, and accents invert to dark-friendly colors
   - Code syntax highlighting switches from "github" to "github-dark" theme
   - Mermaid diagrams adapt with `theme: 'dark'` configuration

---

## User Story / Value Proposition

**Problem**: Users working at night or in low-light environments experience eye strain from the bright white interface. Many modern users expect dark mode as a standard feature, and lack of this option creates a poor UX impression.

**User benefit**:
- Reduced eye strain and fatigue during extended editing sessions
- Comfortable editing in low-light environments (nighttime work, dark offices)
- Meets modern UX expectations and accessibility preferences
- Respects user's system-wide preference for consistent experience

**Use cases**:
1. **Nighttime writing**: Developer writing documentation at night wants dark theme to match their IDE and reduce screen glare
2. **Low-light environments**: User in a dimly lit coffee shop or bedroom prefers dark interface
3. **Eye sensitivity**: User with light sensitivity needs dark mode for comfortable extended use
4. **System consistency**: User with OS-level dark mode enabled expects the editor to match automatically

---

## Implementation Plan

### 1. Define Dark Theme CSS Variables

**File**: `markdown_os/static/css/styles.css`

**Changes**:
- Add `[data-theme="dark"]` selector with dark color palette
- Convert remaining hardcoded colors to CSS variables
- Ensure all color references use `var(--variable-name)`

**Code Location**: Lines 1-13 (after existing `:root` block)

**Example Code**:
```css
/* Light theme (default) */
:root {
  color-scheme: light;
  --bg: #f7f8fa;
  --panel-bg: #ffffff;
  --border: #d9dee7;
  --text: #17233b;
  --text-muted: #60708f;
  --accent: #2563eb;
  --accent-soft: #dbeafe;
  --success: #0f766e;
  --danger: #b91c1c;
  --shadow: 0 6px 20px rgba(17, 24, 39, 0.08);

  /* Editor-specific colors */
  --editor-bg: #ffffff;
  --editor-text: #111827;
  --tab-nav-bg: #fafcff;
  --tab-button-bg: #ffffff;
  --code-block-bg: #f8fafc;
  --code-header-bg: #f3f7ff;
}

/* Dark theme */
[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f172a;
  --panel-bg: #1e293b;
  --border: #334155;
  --text: #e2e8f0;
  --text-muted: #94a3b8;
  --accent: #60a5fa;
  --accent-soft: #1e3a5f;
  --success: #14b8a6;
  --danger: #f87171;
  --shadow: 0 6px 20px rgba(0, 0, 0, 0.3);

  /* Editor-specific colors */
  --editor-bg: #1e293b;
  --editor-text: #e2e8f0;
  --tab-nav-bg: #0f172a;
  --tab-button-bg: #1e293b;
  --code-block-bg: #0f172a;
  --code-header-bg: #1e3a5f;
}
```

**Rationale**: Using `data-theme` attribute on `<html>` element is a clean, semantic approach. CSS variables ensure a single source of truth for colors, making theme switching instant and maintainable.

---

### 2. Replace Hardcoded Colors with CSS Variables

**File**: `markdown_os/static/css/styles.css`

**Changes**:
- Line 193-204: Replace `#111827` and `#ffffff` in `#markdown-editor` with `var(--editor-text)` and `var(--editor-bg)`
- Line 217: Replace `#1f2937` in `#markdown-preview` with `var(--text)`
- Line 125: Replace `#fafcff` in `.tab-nav` with `var(--tab-nav-bg)`
- Line 136: Replace `#fff` in `.tab-button` with `var(--tab-button-bg)`
- Line 148: Replace `#bfcae0` (tab hover border) with calculated color or new variable
- Line 164-173: Keep status colors but ensure they work in both themes
- Line 250: Replace `#f8fafc` in `.code-block` with `var(--code-block-bg)`
- Line 262: Replace `#f3f7ff` in `.code-block-header` with `var(--code-header-bg)`
- Line 272-284: Update `.copy-button` colors to use variables
- Line 303: Replace `#fff` in `.mermaid-container` with `var(--panel-bg)`

**Example Code**:
```css
#markdown-editor {
  /* ... other properties ... */
  color: var(--editor-text);  /* was #111827 */
  background: var(--editor-bg);  /* was #ffffff */
}

.tab-nav {
  /* ... other properties ... */
  background: var(--tab-nav-bg);  /* was #fafcff */
}

.tab-button {
  /* ... other properties ... */
  background: var(--tab-button-bg);  /* was #fff */
}
```

**Rationale**: Converting hardcoded colors ensures all UI elements respond to theme changes. Missing even one element creates visual inconsistency.

---

### 3. Add Syntax Highlighting Theme Switching

**File**: `markdown_os/static/index.html`

**Changes**:
- Add dark theme CDN link for highlight.js
- Add `id` attributes to both theme links for JavaScript toggling

**Code Location**: Lines 8-11

**Example Code**:
```html
<!-- Light theme (default) -->
<link
  id="highlight-light"
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css"
/>
<!-- Dark theme (initially disabled) -->
<link
  id="highlight-dark"
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
  disabled
/>
```

**Rationale**: highlight.js requires separate CSS files for light/dark themes. Using `disabled` attribute allows instant switching without re-downloading files.

---

### 4. Add Theme Toggle Button to Header

**File**: `markdown_os/static/index.html`

**Changes**:
- Add theme toggle button between tab-group and save-status
- Include SVG icons for sun (light mode) and moon (dark mode)

**Code Location**: Line 31 (inside `.tab-nav`, after `.tab-group`)

**Example Code**:
```html
<div class="tab-nav">
  <div class="tab-group">
    <button id="edit-tab" class="tab-button active" type="button">Edit</button>
    <button id="preview-tab" class="tab-button" type="button">Preview</button>
  </div>

  <!-- Theme toggle button -->
  <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle theme" title="Toggle theme">
    <svg id="theme-icon-sun" class="theme-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
    <svg id="theme-icon-moon" class="theme-icon hidden" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  </button>

  <span id="save-status" aria-live="polite">Idle</span>
</div>
```

**Rationale**: Placing the toggle in the header makes it easily accessible. Using SVG icons provides crisp, scalable visuals. Showing sun in light mode and moon in dark mode is intuitive UX convention.

---

### 5. Style the Theme Toggle Button

**File**: `markdown_os/static/css/styles.css`

**Changes**:
- Add `.theme-toggle` button styling
- Add `.theme-icon` styling with smooth transitions

**Code Location**: After line 157 (after `.tab-button.active`)

**Example Code**:
```css
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-bg);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.theme-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.theme-icon {
  display: block;
  transition: transform 0.2s ease;
}

.theme-toggle:hover .theme-icon {
  transform: rotate(15deg);
}
```

**Rationale**: Consistent styling with existing tab buttons. Subtle rotation on hover provides interactive feedback.

---

### 6. Implement Theme Management JavaScript

**File**: `markdown_os/static/js/theme.js` (new file)

**Changes**:
- Create new JavaScript module for theme logic
- Implement localStorage persistence
- Add system preference detection
- Handle theme toggle interactions
- Switch syntax highlighting theme

**Example Code**:
```javascript
/**
 * Theme management for markdown-os
 * Handles dark/light theme switching with system preference detection
 */

const THEME_KEY = 'markdown-os-theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

class ThemeManager {
  constructor() {
    this.currentTheme = null;
    this.systemPreference = null;
    this.hasManualPreference = false;

    this.sunIcon = document.getElementById('theme-icon-sun');
    this.moonIcon = document.getElementById('theme-icon-moon');
    this.toggleButton = document.getElementById('theme-toggle');
    this.highlightLight = document.getElementById('highlight-light');
    this.highlightDark = document.getElementById('highlight-dark');
  }

  /**
   * Initialize theme system
   * - Check localStorage for saved preference
   * - Detect system preference
   * - Apply theme before content renders
   * - Setup event listeners
   */
  init() {
    // Check for saved preference
    const savedTheme = localStorage.getItem(THEME_KEY);

    if (savedTheme) {
      // User has explicitly chosen a theme
      this.hasManualPreference = true;
      this.applyTheme(savedTheme);
    } else {
      // No saved preference, use system preference
      this.detectSystemPreference();
      this.applyTheme(this.systemPreference);
    }

    // Setup toggle button
    this.toggleButton.addEventListener('click', () => this.toggleTheme());

    // Listen for system preference changes (only matters if no manual preference)
    this.watchSystemPreference();
  }

  /**
   * Detect system theme preference
   */
  detectSystemPreference() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemPreference = prefersDark.matches ? THEME_DARK : THEME_LIGHT;
  }

  /**
   * Watch for system preference changes
   */
  watchSystemPreference() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    prefersDark.addEventListener('change', (e) => {
      this.systemPreference = e.matches ? THEME_DARK : THEME_LIGHT;

      // Only auto-switch if user hasn't manually chosen
      if (!this.hasManualPreference) {
        this.applyTheme(this.systemPreference);
      }
    });
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    const newTheme = this.currentTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
    this.hasManualPreference = true;
    localStorage.setItem(THEME_KEY, newTheme);
    this.applyTheme(newTheme);
  }

  /**
   * Apply theme to the page
   */
  applyTheme(theme) {
    this.currentTheme = theme;

    // Set data-theme attribute on html element
    document.documentElement.setAttribute('data-theme', theme);

    // Update toggle button icon
    if (theme === THEME_DARK) {
      this.sunIcon.classList.add('hidden');
      this.moonIcon.classList.remove('hidden');
    } else {
      this.sunIcon.classList.remove('hidden');
      this.moonIcon.classList.add('hidden');
    }

    // Switch syntax highlighting theme
    if (theme === THEME_DARK) {
      this.highlightLight.disabled = true;
      this.highlightDark.disabled = false;
    } else {
      this.highlightLight.disabled = false;
      this.highlightDark.disabled = true;
    }

    // Update Mermaid theme if diagrams exist
    this.updateMermaidTheme(theme);
  }

  /**
   * Update Mermaid diagram theme
   */
  updateMermaidTheme(theme) {
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === THEME_DARK ? 'dark' : 'default'
      });

      // Re-render existing diagrams if any
      const diagrams = document.querySelectorAll('.mermaid');
      diagrams.forEach((diagram) => {
        // Store original content
        const content = diagram.getAttribute('data-original-content');
        if (content) {
          diagram.textContent = content;
          diagram.removeAttribute('data-processed');
        }
      });

      // Re-initialize Mermaid
      if (diagrams.length > 0) {
        mermaid.run();
      }
    }
  }
}

// Initialize theme as early as possible (before DOM ready to prevent flash)
const themeManager = new ThemeManager();
themeManager.init();
```

**Rationale**: Separating theme logic into its own module keeps code organized. Early initialization prevents "flash of unstyled content". System preference detection provides smart defaults while respecting user choice.

---

### 7. Load Theme Script Before Other Scripts

**File**: `markdown_os/static/index.html`

**Changes**:
- Add `theme.js` script tag BEFORE other scripts (line 48)
- Ensures theme applies before content renders

**Code Location**: Line 48 (before websocket.js)

**Example Code**:
```html
<!-- Load theme first to prevent flash -->
<script src="/static/js/theme.js"></script>
<script src="/static/js/websocket.js"></script>
<script src="/static/js/markdown.js"></script>
<script src="/static/js/toc.js"></script>
<script src="/static/js/editor.js"></script>
```

**Rationale**: Loading theme.js first prevents visible theme "flash" on page load. Users see the correct theme immediately.

---

### 8. Update Mermaid Initialization for Theme Support

**File**: `markdown_os/static/js/markdown.js`

**Changes**:
- Store original diagram content in `data-original-content` attribute for re-rendering
- Initialize Mermaid with theme awareness

**Code Location**: Find Mermaid initialization code

**Example Code**:
```javascript
// When processing Mermaid diagrams, store original content
const mermaidBlocks = document.querySelectorAll('.language-mermaid');
mermaidBlocks.forEach((block) => {
  const container = document.createElement('div');
  container.className = 'mermaid-container';
  const diagram = document.createElement('div');
  diagram.className = 'mermaid';
  diagram.textContent = block.textContent;

  // Store original content for theme switching
  diagram.setAttribute('data-original-content', block.textContent);

  container.appendChild(diagram);
  block.parentElement.replaceWith(container);
});
```

**Rationale**: Mermaid diagrams need to be re-rendered when theme changes. Storing original content enables this.

---

### 9. Add Smooth Theme Transition

**File**: `markdown_os/static/css/styles.css`

**Changes**:
- Add global transition for color properties during theme switch

**Code Location**: After line 15 (in `*` selector or new rule)

**Example Code**:
```css
/* Smooth theme transitions */
*,
*::before,
*::after {
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

/* Disable transitions on page load to prevent flash */
html.loading * {
  transition: none !important;
}
```

**JavaScript addition** in `theme.js`:
```javascript
// Add loading class initially
document.documentElement.classList.add('loading');

// Remove after theme applied
setTimeout(() => {
  document.documentElement.classList.remove('loading');
}, 100);
```

**Rationale**: Smooth transitions provide polished UX. Disabling on load prevents unwanted animation during initial render.

---

## Edge Cases to Handle

#### Case 1: Theme Switch During Active Editing
- **Scenario**: User is typing in editor and clicks theme toggle
- **Expected behavior**: Theme switches smoothly without losing cursor position or focus
- **Implementation note**: CSS-only theme switching preserves DOM state. No special handling needed.

#### Case 2: Mermaid Diagrams Already Rendered
- **Scenario**: User switches theme with existing Mermaid diagrams in preview
- **Expected behavior**: Diagrams re-render in new theme colors
- **Implementation note**: Store original diagram source in `data-original-content`, re-process on theme change

#### Case 3: System Theme Changes While Editor Open
- **Scenario**: User's OS switches from light to dark mode (e.g., automatic sunset trigger)
- **Expected behavior**:
  - If user has NOT manually set theme: Editor auto-switches to match OS
  - If user HAS manually set theme: Editor respects user choice, ignores OS change
- **Implementation note**: `watchSystemPreference()` method checks `hasManualPreference` flag

#### Case 4: localStorage Unavailable (Private Browsing)
- **Scenario**: User has localStorage disabled or in private browsing mode
- **Expected behavior**: Theme toggle still works for current session, falls back to system preference on reload
- **Implementation note**: Wrap localStorage calls in try-catch, gracefully degrade

#### Case 5: Page Reload / Browser Restart
- **Scenario**: User closes browser and reopens editor
- **Expected behavior**: Previous theme choice is restored from localStorage
- **Implementation note**: `init()` method reads from localStorage first

#### Case 6: Multiple Browser Tabs
- **Scenario**: User has editor open in multiple tabs and changes theme in one
- **Expected behavior**: Each tab maintains its own theme until reloaded (no cross-tab sync)
- **Implementation note**: No special handling needed. Cross-tab sync could be added later with `storage` event listener if desired.

#### Case 7: Syntax Highlighting During Theme Switch
- **Scenario**: User switches theme while viewing code blocks in preview
- **Expected behavior**: Code blocks instantly switch to new highlight.js theme
- **Implementation note**: Toggling `disabled` attribute on `<link>` tags instantly switches highlight.js styles

---

## Testing Considerations

**Manual Tests**:

**Basic Flow:**
1. **Initial load (no preference)** → Should detect system preference and apply matching theme
2. **Initial load (dark system)** → Should apply dark theme automatically
3. **Click theme toggle** → Should switch theme instantly with smooth transition
4. **Reload after toggle** → Should restore manually selected theme from localStorage
5. **Change OS theme (no manual selection)** → Should auto-switch to match OS
6. **Change OS theme (after manual selection)** → Should keep user's manual choice

**Visual Checks:**
1. **All UI elements** → Verify background, text, borders use theme colors
2. **Code blocks** → Syntax highlighting switches between github/github-dark
3. **Mermaid diagrams** → Diagrams render in theme-appropriate colors
4. **TOC sidebar** → Background, text, active states use theme colors
5. **Save status** → Success/error colors remain visible in both themes
6. **Tab buttons** → Hover and active states work in both themes
7. **Theme toggle button** → Icon switches between sun/moon, hover effect works

**Edge Cases:**
1. **Rapid toggle clicking** → Should handle multiple fast clicks gracefully
2. **Switch while editing** → Cursor position and unsaved changes preserved
3. **Private browsing** → Theme toggle works, falls back to system on reload
4. **Narrow viewport** → Theme toggle visible and functional on mobile/tablet sizes

**Automated Tests (Optional)**:
- Unit test for `ThemeManager` class methods
- localStorage mock tests for persistence logic
- matchMedia mock tests for system preference detection

---

## Files to Modify

| File | Changes |
|------|---------|
| `markdown_os/static/css/styles.css` | • Add dark theme CSS variables in `[data-theme="dark"]` selector<br>• Replace hardcoded colors with CSS variables<br>• Add theme toggle button styling<br>• Add smooth transition rules |
| `markdown_os/static/index.html` | • Add dark syntax highlighting CDN link<br>• Add IDs to highlight.js links<br>• Add theme toggle button HTML with SVG icons<br>• Load theme.js before other scripts |
| `markdown_os/static/js/theme.js` | • **NEW FILE**: Create ThemeManager class<br>• Implement localStorage persistence<br>• Add system preference detection<br>• Handle theme toggle interactions<br>• Switch syntax highlighting themes<br>• Update Mermaid theme configuration |
| `markdown_os/static/js/markdown.js` | • Store Mermaid diagram source in `data-original-content` attribute<br>• Support diagram re-rendering on theme change |

---

## Decisions / Open Questions

### Q1: Should theme preference sync across browser tabs? ✅
**Options**:
- **Option A**: No cross-tab sync (each tab independent until reload)
- **Option B**: Use `storage` event listener to sync theme changes across tabs in real-time

**Decision**: **Option A selected** - Keep implementation simple for MVP. Each tab maintains its own theme state. When a tab is reloaded, it will pick up the latest localStorage value. Cross-tab sync can be added later if users request it.

**Rationale**: Simpler implementation, no additional complexity. Most users work in single tab. Real-time sync adds minimal value.

---

### Q2: How to handle Mermaid theme switching? ✅
**Options**:
- **Option A**: Store original diagram source and re-render on theme change
- **Option B**: Let diagrams keep their original theme (no re-rendering)

**Decision**: **Option A selected** - Re-render diagrams to match theme. Store original source in `data-original-content` attribute and call `mermaid.run()` after theme change.

**Rationale**: Better UX consistency. Diagrams with fixed colors would look out of place in opposite theme. Small performance cost is acceptable for polished experience.

---

## Implementation Checklist

### Phase 1: Core CSS & HTML Structure
- [ ] Define dark theme CSS variables in `styles.css`
- [ ] Replace all hardcoded colors with CSS variables
- [ ] Add theme toggle button HTML to `index.html`
- [ ] Style theme toggle button in `styles.css`
- [ ] Add dark syntax highlighting CDN link to `index.html`

### Phase 2: JavaScript Theme Logic
- [ ] Create `theme.js` file with ThemeManager class
- [ ] Implement localStorage persistence logic
- [ ] Add system preference detection with `matchMedia`
- [ ] Handle theme toggle button clicks
- [ ] Switch syntax highlighting themes (enable/disable links)
- [ ] Load `theme.js` before other scripts in `index.html`

### Phase 3: Mermaid & Polish
- [ ] Update Mermaid diagram processing in `markdown.js` to store original content
- [ ] Implement Mermaid theme switching in ThemeManager
- [ ] Add smooth CSS transitions for theme changes
- [ ] Prevent transition flash on initial page load

### Phase 4: Testing & Documentation
- [ ] Test all manual scenarios (initial load, toggle, reload, system changes)
- [ ] Visual check: Verify all UI elements adapt correctly in both themes
- [ ] Edge case testing: Rapid clicks, private browsing, multiple tabs
- [ ] Cross-browser testing: Chrome, Firefox, Safari
- [ ] Update CLAUDE.md with dark mode feature description
- [ ] Update README.md with theme toggle instructions
- [ ] Take screenshots for documentation (light vs dark comparison)

---

## Success Criteria

### Core Functionality
✅ Dark theme successfully applied to all UI elements (background, text, borders, buttons)
✅ Theme toggle button switches between light and dark instantly
✅ Theme preference persists across page reloads via localStorage
✅ System preference auto-detection works on initial load (no manual preference)
✅ System preference changes auto-apply when no manual override exists
✅ Manual theme selection overrides system preference

### Syntax Highlighting & Diagrams
✅ Code blocks switch between github (light) and github-dark (dark) themes
✅ Mermaid diagrams render in theme-appropriate colors
✅ Diagrams re-render correctly when theme switches

### UX / Polish
✅ Theme switch is smooth with CSS transitions (no jarring flash)
✅ No "flash of unstyled content" on page load
✅ Toggle button displays correct icon (sun in light, moon in dark)
✅ All text remains readable in both themes (sufficient contrast)
✅ Save status, success, and error colors visible in both themes

### Edge Cases
✅ Cursor position and content preserved when switching theme while editing
✅ localStorage unavailable (private browsing) handled gracefully
✅ Rapid toggle clicks don't cause visual glitches
✅ Theme toggle button visible and functional on mobile/tablet viewports
