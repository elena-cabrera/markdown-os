# Feature Plan: Line Numbers for Code Blocks

**Status:** Draft
**Created:** 2026-02-15
**Author:** Claude (via feature-planner skill)

---

## Overview

Add line numbers to code blocks in Preview mode to improve code readability and enable easier reference to specific lines in documentation and discussions.

**Key Features:**
- Line numbers displayed for all syntax-highlighted code blocks
- Non-selectable line numbers (don't interfere with code copying)
- Proper alignment and spacing
- Styled for both light and dark themes
- Excludes Mermaid diagram blocks (which render as graphics, not code)

**Includes:**
- JavaScript line wrapping logic in `markdown.js`
- CSS counter-based line numbering
- Theme-aware styling for line number gutters
- Integration with existing code block decoration pipeline

---

## User Story / Value Proposition

**Problem:**
When developers discuss code snippets in documentation, meeting notes, or technical specs, they need to reference specific lines. Currently, code blocks have no line numbers, making it difficult to say "On line 15..." or "Lines 22-25 need review." Users must manually count lines or copy code into an external editor.

**Solution:**
Display automatic line numbers in a left gutter for all code blocks. Line numbers are non-selectable, so copying code remains clean without line number prefixes.

**User Benefit:**
- **Easier code review discussions** - "See line 12 in the example above"
- **Better documentation** - Technical writing can reference specific lines
- **Familiar developer UX** - Matches GitHub, GitLab, VS Code, and other dev tools
- **Improved readability** - Line numbers provide visual structure for long code samples

**Use Cases:**
1. **Technical documentation** - "The bug occurs on line 42 of the config example"
2. **Code review notes** - "Lines 15-18 need error handling"
3. **Tutorial writing** - "Add the import statement on line 3"
4. **Meeting notes** - "Action item: refactor the function at lines 10-25"

---

## Current Behavior

### Code Block Rendering Pipeline

**From:** `markdown_os/static/js/markdown.js`

1. **Markdown parsing** (line 257): Marked.js converts code fences to `<pre><code>` elements
2. **Code block decoration** (line 258): `addCodeBlockDecorations()` runs
3. **Decoration steps** (lines 53-115):
   - Query all `<pre><code>` elements
   - Wrap each in `.code-block` div with header
   - Add language label and copy button
   - Apply syntax highlighting with highlight.js

**Current HTML structure:**
```html
<div class="code-block">
  <div class="code-block-header">
    <span class="code-language-label">PYTHON</span>
    <button class="copy-button">Copy</button>
  </div>
  <pre>
    <code class="language-python hljs">
      <span class="hljs-keyword">def</span> hello():
          <span class="hljs-built_in">print</span>(<span class="hljs-string">"world"</span>)
    </code>
  </pre>
</div>
```

### Code Block Styling

**From:** `markdown_os/static/css/styles.css`

- `.code-block` - Border, border-radius, background (lines 378-383)
- `.code-block-header` - Language label and copy button bar (lines 385-395)
- Highlight.js applies syntax colors via CDN stylesheets

### Special Handling

- **Mermaid blocks** (lines 159-180): Code blocks with `language-mermaid` are converted to diagram containers
- **Copy functionality** (lines 83-99): Copy button extracts `codeElement.textContent`

---

## Proposed Behavior

### Visual Appearance

**Code block with line numbers:**
```
┌─────────────────────────────────────┐
│ PYTHON                        Copy  │ ← Header (unchanged)
├─────────────────────────────────────┤
│ 1 │ def factorial(n):              │
│ 2 │     if n <= 1:                 │
│ 3 │         return 1                │
│ 4 │     return n * factorial(n-1)  │
│ 5 │                                 │
└─────────────────────────────────────┘
```

**Line number gutter:**
- Fixed-width column on the left (40-50px)
- Right-aligned numbers
- Subtle color (muted text color)
- Vertical border separating gutter from code
- Non-selectable (using `user-select: none`)

**Copy behavior:**
- Clicking "Copy" only copies code, not line numbers
- Selecting code with mouse excludes line numbers

---

## Implementation Plan

### 1. Add Line Wrapping Logic

**File:** `markdown_os/static/js/markdown.js`

**Changes:**
- Add `addLineNumbers(codeElement)` function after line 115
- Call this function during code block decoration, after highlight.js runs
- Function should:
  1. Get the text content of the code block
  2. Split by newlines (`\n`)
  3. Wrap each line in a `<span class="line">` element
  4. Replace code element's innerHTML with wrapped lines
  5. Handle empty lines correctly

**Code Location:** After line 115 (`addCodeBlockDecorations` function)

**Example Code:**
```javascript
function addLineNumbers(codeElement) {
  // Get the text content before highlighting added spans
  const codeText = codeElement.textContent || "";

  // Split into lines, preserving empty lines
  const lines = codeText.split("\n");

  // Create a document fragment for performance
  const fragment = document.createDocumentFragment();

  lines.forEach((lineText, index) => {
    const lineSpan = document.createElement("span");
    lineSpan.className = "line";
    lineSpan.textContent = lineText || "\n"; // Preserve empty lines
    fragment.appendChild(lineSpan);

    // Add newline between lines (except last line)
    if (index < lines.length - 1) {
      fragment.appendChild(document.createTextNode("\n"));
    }
  });

  // Replace code content with line-wrapped version
  codeElement.innerHTML = "";
  codeElement.appendChild(fragment);
}
```

**Rationale:**
Wrapping each line in a `<span>` allows CSS counters to increment per line. Using `textContent` instead of `innerHTML` preserves the highlighted HTML structure from highlight.js.

**Wait, there's an issue:** If we use `textContent`, we lose the syntax highlighting HTML that highlight.js added. We need a different approach.

**Revised Approach:**
Instead of splitting `textContent`, we should:
1. Let highlight.js run first (it adds syntax spans)
2. Then parse the highlighted HTML
3. Wrap display lines (accounting for `\n` in the HTML)

Actually, a simpler approach:
- Use CSS `display: table` layout
- Use `::before` pseudo-element with CSS counter
- The code element can remain unchanged

Let me revise to use a CSS-only approach with careful styling.

**Better Approach: CSS Grid + Counters**

Actually, after more thought, the cleanest solution is:
1. Add a line numbers container as a sibling to `<pre>`
2. Count lines in JS, generate line number elements
3. Use CSS Grid to position them side-by-side

Let me rewrite this section:

---

### 1. Generate Line Number Elements

**File:** `markdown_os/static/js/markdown.js`

**Changes:**
- Add `addLineNumbers(preElement, codeElement)` function
- Call from `addCodeBlockDecorations()` before syntax highlighting
- Generate line numbers based on line count in code

**Code Location:** After line 115 (end of `addCodeBlockDecorations` function)

**Integration Point:** Inside `addCodeBlockDecorations()` forEach loop:
```javascript
codeBlocks.forEach((codeElement) => {
  const preElement = codeElement.parentElement;
  if (!preElement || preElement.dataset.decorated === "true") {
    return;
  }

  preElement.dataset.decorated = "true";

  const languageLabel = inferLanguageLabel(codeElement);
  const wrapper = document.createElement("div");
  wrapper.className = "code-block";

  const header = document.createElement("div");
  header.className = "code-block-header";

  // ... header setup code ...

  wrapper.appendChild(header);

  // Add line numbers HERE, before adding the pre element
  const lineCount = (codeElement.textContent || "").split("\n").length;
  const lineNumbersDiv = createLineNumbers(lineCount);

  const codeWrapper = document.createElement("div");
  codeWrapper.className = "code-wrapper";
  codeWrapper.appendChild(lineNumbersDiv);
  codeWrapper.appendChild(preElement);

  wrapper.appendChild(codeWrapper);
  preElement.replaceWith(wrapper);

  // Syntax highlighting happens after
  if (window.hljs && languageLabel !== "mermaid" && !codeElement.classList.contains("hljs")) {
    window.hljs.highlightElement(codeElement);
  }
});
```

**New Function:**
```javascript
function createLineNumbers(lineCount) {
  const lineNumbers = document.createElement("div");
  lineNumbers.className = "line-numbers";
  lineNumbers.setAttribute("aria-hidden", "true"); // Accessibility: hide from screen readers

  for (let i = 1; i <= lineCount; i++) {
    const lineNum = document.createElement("span");
    lineNum.className = "line-number";
    lineNum.textContent = i;
    lineNumbers.appendChild(lineNum);
  }

  return lineNumbers;
}
```

**Rationale:**
- Generate line numbers before highlighting to know exact line count
- Use a separate `<div class="line-numbers">` sibling to `<pre>`
- CSS Grid will position them side-by-side
- Each line number is a `<span>` with the line number as text
- `aria-hidden` prevents screen readers from announcing line numbers

---

### 2. Update HTML Structure with Grid Layout

**File:** `markdown_os/static/js/markdown.js`

**Changes:**
- Modify `addCodeBlockDecorations()` to create new wrapper structure
- Add `.code-wrapper` div containing line numbers and pre element side-by-side

**New HTML Structure:**
```html
<div class="code-block">
  <div class="code-block-header">
    <span class="code-language-label">PYTHON</span>
    <button class="copy-button">Copy</button>
  </div>
  <div class="code-wrapper">
    <div class="line-numbers" aria-hidden="true">
      <span class="line-number">1</span>
      <span class="line-number">2</span>
      <span class="line-number">3</span>
    </div>
    <pre><code class="language-python hljs">
      <!-- highlighted code -->
    </code></pre>
  </div>
</div>
```

**Code Changes:** (see integration in section 1 above)

---

### 3. Add CSS Styling for Line Numbers

**File:** `markdown_os/static/css/styles.css`

**Changes:**
- Add `.code-wrapper` grid layout
- Add `.line-numbers` gutter styling
- Style `.line-number` spans
- Add theme-specific colors

**Code Location:** After line 432 (after `.code-block pre` styles)

**Example Code:**
```css
/* Code wrapper with line numbers grid */
.code-wrapper {
  display: grid;
  grid-template-columns: auto 1fr;
  overflow-x: auto;
}

/* Line numbers gutter */
.line-numbers {
  display: flex;
  flex-direction: column;
  padding: 12px 0;
  padding-right: 12px;
  padding-left: 8px;
  background: var(--code-header-bg);
  border-right: 1px solid var(--border);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  font-family:
    "JetBrains Mono",
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    "Liberation Mono",
    "Courier New",
    monospace;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-muted);
  text-align: right;
  min-width: 40px;
}

/* Individual line number */
.line-number {
  display: block;
  line-height: 1.5;
  min-height: 1.5em;
  padding-right: 6px;
}

/* Adjust pre element to work with grid */
.code-wrapper pre {
  grid-column: 2;
  margin: 0;
  padding: 12px 16px;
  overflow-x: visible;
  border-radius: 0;
}

/* Ensure code blocks with line numbers don't have conflicting margins */
.code-block .code-wrapper pre {
  margin: 0 !important;
  border: 0 !important;
}
```

**Rationale:**
- CSS Grid cleanly separates line numbers from code
- `user-select: none` prevents line numbers from being selected/copied
- Line numbers use same font as code for alignment
- Gutter has subtle background to distinguish from code area
- Same `line-height: 1.5` ensures numbers align with code lines

---

### 4. Ensure Copy Button Still Works

**File:** `markdown_os/static/js/markdown.js`

**Changes:**
- Verify copy button extracts code without line numbers
- Current implementation uses `codeElement.textContent` which should work unchanged

**Code Location:** Line 85 (copy button click handler)

**Current Code:**
```javascript
await copyToClipboard(codeElement.textContent || "");
```

**Verification:**
- `codeElement` references the `<code>` tag, not the line numbers div
- Line numbers are a separate sibling element
- No changes needed - copy functionality works as-is

**Testing:**
- Click copy button on code block with line numbers
- Paste into text editor
- Verify only code is pasted (no line numbers)

---

### 5. Exclude Mermaid Blocks from Line Numbers

**File:** `markdown_os/static/js/markdown.js`

**Changes:**
- Skip line number generation for Mermaid code blocks
- Check language label before creating line numbers

**Code Location:** Inside `addCodeBlockDecorations()` loop (see section 1)

**Implementation:**
```javascript
// Don't add line numbers to Mermaid blocks (they become diagrams)
if (languageLabel !== "mermaid") {
  const lineCount = (codeElement.textContent || "").split("\n").length;
  const lineNumbersDiv = createLineNumbers(lineCount);

  const codeWrapper = document.createElement("div");
  codeWrapper.className = "code-wrapper";
  codeWrapper.appendChild(lineNumbersDiv);
  codeWrapper.appendChild(preElement);

  wrapper.appendChild(codeWrapper);
} else {
  // Mermaid blocks: no line numbers, just append pre
  wrapper.appendChild(preElement);
}
```

**Rationale:**
- Mermaid blocks are replaced with diagram SVGs later in the pipeline
- Line numbers on diagram source code aren't useful
- Keeps Mermaid rendering simple and unchanged

---

### 6. Handle Edge Cases

**File:** `markdown_os/static/js/markdown.js`

**Edge Cases to Handle:**

#### Empty Lines
- **Issue:** Empty lines have no text, may collapse
- **Solution:** Line numbers still generated (line count includes empty lines)
- **Code:** `(codeElement.textContent || "").split("\n").length` counts all lines

#### Single-Line Code Blocks
- **Issue:** One-line code may look weird with line number gutter
- **Solution:** Line numbers still shown (consistent UI, minimal downside)
- **Alternative:** Could hide line numbers if `lineCount === 1`, but inconsistent

#### Very Long Code Blocks (100+ lines)
- **Issue:** Line numbers take up space (e.g., "123" is wider than "9")
- **Solution:** `min-width: 40px` on `.line-numbers` accommodates 3-digit numbers
- **For 1000+ lines:** CSS would need adjustment, but rare in markdown docs

#### Horizontal Scrolling
- **Issue:** Long code lines cause horizontal scroll
- **Solution:** `.code-wrapper` has `overflow-x: auto`, line numbers stay fixed on left
- **CSS:** Grid layout keeps line numbers in view while code scrolls

#### Theme Switching
- **Issue:** Line number colors need to update with theme
- **Solution:** Use CSS variables (`var(--text-muted)`, `var(--code-header-bg)`)
- **Behavior:** Line numbers automatically re-style on theme change

---

## Files to Modify

| File | Changes |
|------|---------|
| `markdown_os/static/js/markdown.js` | • Add `createLineNumbers(lineCount)` function<br>• Modify `addCodeBlockDecorations()` to generate line numbers<br>• Add `.code-wrapper` div wrapping line numbers + pre element<br>• Skip line numbers for Mermaid blocks |
| `markdown_os/static/css/styles.css` | • Add `.code-wrapper` grid layout styles<br>• Add `.line-numbers` gutter styles<br>• Add `.line-number` span styles<br>• Adjust `.code-block pre` margins for grid<br>• Ensure styles work in light + dark themes |

---

## Decisions / Open Questions

### Q1: Should we add line numbers to inline code? ✅

**Options:**
- **Option A**: No - only fenced code blocks get line numbers
- **Option B**: Yes - inline code `like this` also gets line numbers

**Decision:** Option A selected - Inline code is single-line by definition and appears inline with text. Line numbers don't make sense in that context. Only fenced code blocks (triple backtick) get line numbers.

### Q2: Should line numbers start at 1 or 0? ✅

**Options:**
- **Option A**: Start at 1 (standard for most editors and tools)
- **Option B**: Start at 0 (programmer convention for some contexts)

**Decision:** Option A selected - Start at 1, matching GitHub, VS Code, and most text editors. More intuitive for non-programmers.

### Q3: How should we handle code blocks with trailing newlines? ✅

**Scenario:** User writes:
````markdown
```python
def hello():
    print("world")

```
````
This has a trailing newline, so line count would be 4 (with line 4 being empty).

**Options:**
- **Option A**: Show all lines including trailing empty line
- **Option B**: Trim trailing newlines before counting

**Decision:** Option A selected - Show all lines as-is. Markdown may have intentional trailing newlines. Better to be explicit than hide structure.

### Q4: Should very long files (500+ lines) have performance optimizations? ✅

**Options:**
- **Option A**: No optimization - generate all line numbers upfront
- **Option B**: Virtualization - only render visible line numbers

**Decision:** Option A selected for MVP - Long code blocks in markdown docs are rare. Generating 500 `<span>` elements is negligible performance-wise. Can optimize later if needed.

---

## Edge Cases

### Case 1: Empty code block
- **Scenario:** User creates code fence with no content:
  ````markdown
  ```python
  ```
  ````
- **Expected behavior:** Line count is 1 (one empty line), shows line number "1" with empty code area
- **Implementation note:** `split("\n")` on empty string returns `[""]` (array with one empty string), so lineCount = 1 ✓

### Case 2: Code block with only whitespace
- **Scenario:**
  ````markdown
  ```python


  ```
  ````
- **Expected behavior:** Line count is 3, shows line numbers 1-3 with blank code lines
- **Implementation note:** `split("\n")` correctly counts newlines ✓

### Case 3: Very wide code block (horizontal scroll)
- **Scenario:** Code line is 200 characters long, exceeds viewport width
- **Expected behavior:** Horizontal scrollbar appears, line numbers stay fixed on left
- **Implementation note:** CSS Grid keeps line numbers in first column, code in second column. `.code-wrapper` has `overflow-x: auto` for scroll ✓

### Case 4: Mixing Mermaid and regular code blocks
- **Scenario:** Document has both Python code and Mermaid diagrams
- **Expected behavior:** Python code gets line numbers, Mermaid blocks don't
- **Implementation note:** `languageLabel !== "mermaid"` check excludes Mermaid blocks ✓

### Case 5: Code block inside blockquote
- **Scenario:**
  ```markdown
  > Here's an example:
  > ```python
  > def foo():
  >     pass
  > ```
  ```
- **Expected behavior:** Line numbers display normally, blockquote styling applied to entire code block
- **Implementation note:** Marked.js handles blockquote nesting, our code block decoration runs the same regardless of parent context ✓

### Case 6: Syntax highlighting fails
- **Scenario:** Highlight.js doesn't recognize language or fails to load
- **Expected behavior:** Line numbers still display, code shows without syntax colors
- **Implementation note:** Line numbers generated before highlight.js runs, so failure doesn't affect them ✓

### Case 7: Copy button with very long code
- **Scenario:** 500-line code block, user clicks copy
- **Expected behavior:** All code copies successfully without line numbers
- **Implementation note:** `codeElement.textContent` gets full text content, line numbers are in separate div ✓

### Case 8: User zooms browser to 200%
- **Scenario:** Browser zoom increases font size
- **Expected behavior:** Line numbers and code scale together, remain aligned
- **Implementation note:** All sizing uses `em` units and same `line-height`, scales proportionally ✓

---

## Testing Strategy

### Manual Testing Checklist

#### Basic Functionality
1. Open markdown file with code block → line numbers should appear on left
2. Check single-line code block → shows "1"
3. Check 10-line code block → shows numbers 1-10 vertically
4. Check empty code block → shows "1"
5. Check code block with empty lines → all lines numbered sequentially

#### Visual Appearance
6. Verify line numbers align with code lines → no offset or misalignment
7. Check light theme → line numbers have subtle color, readable
8. Check dark theme → line numbers have appropriate contrast
9. Verify gutter has visual separation from code → border or background
10. Check multiple languages (Python, JS, Rust) → all have line numbers

#### Copy Functionality
11. Click copy button → paste into editor → should NOT include line numbers
12. Manually select code with mouse → line numbers should NOT be selected
13. Select all (Cmd/Ctrl+A) in code block → line numbers excluded from selection

#### Special Cases
14. Create Mermaid diagram block → should NOT have line numbers
15. Mix Mermaid and Python blocks → only Python has line numbers
16. Check inline code `like this` → should NOT have line numbers
17. Create 100-line code block → line numbers still aligned at bottom
18. Make very wide code line (200 chars) → horizontal scroll appears, line numbers stay fixed

#### Cross-Browser
19. Test in Chrome → line numbers display correctly
20. Test in Firefox → line numbers display correctly
21. Test in Safari → line numbers display correctly

#### Responsive Design
22. Resize window to narrow width → line numbers still visible and aligned
23. View on mobile screen size → code blocks readable, line numbers scale appropriately

### Automated Testing

**Unit Tests** (if adding test coverage):
- Test `createLineNumbers(lineCount)` returns correct number of spans
- Test line count calculation handles edge cases (empty string, trailing newlines)
- Mock DOM creation and verify structure

**Integration Tests:**
- Test full rendering pipeline: markdown → decorated code block with line numbers
- Verify Mermaid blocks excluded from line numbering
- Test that copy functionality doesn't include line numbers (mock clipboard API)

**Visual Regression Tests** (optional):
- Screenshot code blocks before/after feature
- Verify alignment in light/dark themes
- Check various line counts (1, 10, 100 lines)

---

## Implementation Checklist

### Phase 1: Core Functionality
- [ ] Create `createLineNumbers(lineCount)` function
  - [ ] Generate specified number of line number spans
  - [ ] Add `aria-hidden` attribute for accessibility
  - [ ] Return line numbers div
- [ ] Modify `addCodeBlockDecorations()` function
  - [ ] Count lines in code block
  - [ ] Create line numbers div
  - [ ] Create `.code-wrapper` div
  - [ ] Append line numbers and pre as grid children
  - [ ] Skip Mermaid blocks from line numbering
- [ ] Test basic rendering with sample code blocks

### Phase 2: CSS Styling
- [ ] Add `.code-wrapper` grid layout
  - [ ] Define 2-column grid (auto + 1fr)
  - [ ] Enable horizontal scroll
- [ ] Add `.line-numbers` gutter styles
  - [ ] Set padding, background, border
  - [ ] Apply `user-select: none`
  - [ ] Match code font family and size
  - [ ] Set text alignment to right
- [ ] Add `.line-number` span styles
  - [ ] Set line-height to match code
  - [ ] Add padding for spacing
- [ ] Test visual appearance in both themes
- [ ] Verify alignment with various code samples

### Phase 3: Edge Cases & Polish
- [ ] Test copy button functionality
  - [ ] Verify line numbers excluded from copy
  - [ ] Test with various code lengths
- [ ] Test horizontal scrolling with long lines
- [ ] Test with empty and single-line code blocks
- [ ] Test Mermaid exclusion
- [ ] Test theme switching
- [ ] Verify no performance issues with large code blocks

### Phase 4: Testing & Documentation
- [ ] Manual testing against checklist above
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Responsive design testing
- [ ] Update CHANGELOG if applicable
- [ ] Consider adding user documentation

---

## Success Criteria

### Core Functionality
✅ Line numbers appear on all syntax-highlighted code blocks
✅ Line numbers are correctly numbered starting from 1
✅ Line numbers align perfectly with code lines
✅ Mermaid diagram blocks do not have line numbers

### User Experience
✅ Line numbers are visually distinct but not distracting
✅ Gutter has clear separation from code content
✅ Copy button excludes line numbers from copied text
✅ Manually selecting code excludes line numbers

### Visual Design
✅ Line numbers styled consistently in light theme
✅ Line numbers styled consistently in dark theme
✅ Line number font matches code font
✅ Alignment maintains across different code block sizes

### Performance
✅ No noticeable lag when rendering code blocks with line numbers
✅ Large code blocks (100+ lines) render smoothly
✅ Horizontal scrolling works correctly for wide code

### Compatibility
✅ Works in Chrome, Firefox, Safari
✅ Works on mobile/narrow viewports
✅ Doesn't break existing code block features (copy, highlight, Mermaid)

### Code Quality
✅ Implementation follows existing code patterns
✅ CSS uses existing design system variables
✅ Code is documented with clear comments
✅ No console errors or warnings

---

## Timeline Estimate

**Total Effort:** ~2-3 hours for a solo developer

- **Phase 1 (Core):** 1-1.5 hours
- **Phase 2 (CSS):** 0.5-1 hour
- **Phase 3 (Polish):** 0.5 hour
- **Phase 4 (Testing):** 0.5 hour

This is a **Low Effort** task suitable for a single development session. The implementation is straightforward with minimal complexity.

---

## Future Enhancements

Out of scope for MVP but could be considered later:

1. **Line highlighting** - Highlight specific lines (e.g., `python {3,5-7}` syntax)
2. **Start line offset** - Begin numbering at arbitrary number (e.g., snippet from larger file)
3. **Line number toggle** - User preference to show/hide line numbers globally
4. **Syntax errors indicators** - Red highlight on lines with syntax errors
5. **Selectable line numbers** - Click line number to highlight/link to that line
6. **Diff-style indicators** - Show +/- for added/removed lines in diffs
7. **Line number anchors** - Click line number to get shareable URL to that line
8. **Custom styling** - User CSS overrides for line number appearance

---

## References

### Similar Implementations
- **GitHub** - Line numbers in code blocks with click-to-highlight
- **GitLab** - Similar line numbering with anchor links
- **Read the Docs** - Line numbers in documentation code examples
- **VS Code** - Editor gutter with line numbers

### Technical Resources
- CSS Grid Layout: https://css-tricks.com/snippets/css/complete-guide-grid/
- `user-select` CSS: https://developer.mozilla.org/en-US/docs/Web/CSS/user-select
- Highlight.js: https://highlightjs.org/
- Accessibility (aria-hidden): https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-hidden

### Codebase References
- Code block decoration: `markdown.js` lines 53-115
- Code block styling: `styles.css` lines 378-432
- Markdown rendering: `markdown.js` lines 251-265