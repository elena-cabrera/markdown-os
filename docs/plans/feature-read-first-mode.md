# Plan: Read-First Mode with Smart External Change Handling

## Overview

Change the editor's default behavior to open files in read-only preview mode. Users must explicitly switch to edit mode to make changes. External file changes are handled intelligently based on current mode and unsaved work status.

**Includes**: Custom conflict resolution modal with 3-button interface for better UX (replaces browser confirm dialogs).

### Key Features
- **Read-first default**: Files open in Preview mode for safe browsing
- **Smart auto-reload**: External changes reload automatically when safe
- **Conflict resolution modal**: Beautiful 3-button dialog for conflict scenarios
- **Performance optimization**: Preview renders only when visible
- **Auto-save on tab switch**: Intelligent save with conflict detection

---

## Current Behavior

1. File opens with Edit tab active
2. User can immediately type in textarea
3. All external changes prompt for reload confirmation
4. No distinction between "reading" and "editing" intent

## Proposed Behavior

1. File opens with Preview tab active (read mode)
2. User must click Edit tab to enter edit mode
3. External changes handled differently based on context:
   - **In Preview mode (read mode)**: Auto-reload immediately, no prompt
   - **In Edit mode with no unsaved changes**: Auto-reload immediately, no prompt
   - **In Edit mode with unsaved changes**: Prompt user to choose

---

## Implementation Plan

### 1. Change Default Tab on Load

**File**: `markdown_os/static/js/editor.js`

**Changes**:
- In `document.addEventListener("DOMContentLoaded", ...)` callback
- Change from `switchToTab("edit")` to `switchToTab("preview")`
- Ensure preview is rendered on initial load

**Code Location**: Line ~203

---

### 2. Track Edit Mode State

**File**: `markdown_os/static/js/editor.js`

**Changes**:
- Add `isEditMode: false` to `editorState` object
- Update `switchToTab()` function to set `isEditMode = true` when switching to edit tab
- Set `isEditMode = false` when switching to preview tab

**Rationale**: We need to know if the user has entered edit mode to apply correct reload logic

---

### 3. Update External Change Handler Logic

**File**: `markdown_os/static/js/editor.js`

**Function**: `handleExternalChange(detail)`

**New Logic**:
```javascript
// 1. Silent ignore if content is identical
if (detail.content === editor.value) {
  return;
}

// 2. Auto-reload if in preview mode (read mode)
if (!editorState.isEditMode) {
  editor.value = detail.content;
  editorState.lastSavedContent = detail.content;
  await window.renderMarkdown(detail.content);
  setSaveStatus("Reloaded from disk", "saved");
  return;
}

// 3. Auto-reload if in edit mode but no unsaved changes
if (editor.value === editorState.lastSavedContent) {
  editor.value = detail.content;
  editorState.lastSavedContent = detail.content;
  // Note: Don't render since we're in edit mode (preview not visible)
  setSaveStatus("Reloaded from disk", "saved");
  return;
}

// 4. Prompt if in edit mode with unsaved changes
const shouldReload = window.confirm(
  "This file was changed externally and you have unsaved changes. Reload and discard your changes?"
);
if (shouldReload) {
  editor.value = detail.content;
  editorState.lastSavedContent = detail.content;
  setSaveStatus("Reloaded from disk", "saved");
} else {
  setSaveStatus("External change ignored");
}
```

**Note**: Rendering removed from edit mode branches since preview won't be visible.

---

### 4. Add Tab Switch with Auto-save and Conflict Detection

**File**: `markdown_os/static/js/editor.js`

**Function**: Update `switchToTab(tabName)`

**New Logic for Preview Tab Switch**:
```javascript
async function switchToTab(tabName) {
  const editTab = document.getElementById("edit-tab");
  const previewTab = document.getElementById("preview-tab");
  const editorContainer = document.getElementById("editor-container");
  const previewContainer = document.getElementById("preview-container");
  const editor = document.getElementById("markdown-editor");

  if (!editTab || !previewTab || !editorContainer || !previewContainer || !editor) {
    return;
  }

  if (tabName === "edit") {
    editTab.classList.add("active");
    previewTab.classList.remove("active");
    editorContainer.classList.add("active");
    previewContainer.classList.remove("active");
    editorState.isEditMode = true;
    return;
  }

  // Switching to Preview tab
  const hasUnsavedChanges = editor.value !== editorState.lastSavedContent;

  if (hasUnsavedChanges) {
    // Check for external changes (conflict detection)
    const hasConflict = await checkForExternalChanges();

    if (hasConflict) {
      // Show 3-button dialog
      const choice = await showConflictDialog();

      if (choice === "save") {
        await saveContent(); // Save and overwrite external changes
      } else if (choice === "discard") {
        await loadContent(); // Reload from disk
      } else {
        // choice === "cancel" - stay in edit mode
        return;
      }
    } else {
      // No conflict, auto-save
      await saveContent();
    }
  }

  // Switch to preview tab
  editTab.classList.remove("active");
  previewTab.classList.add("active");
  editorContainer.classList.remove("active");
  previewContainer.classList.add("active");
  editorState.isEditMode = false;

  // Render preview on-demand
  await window.renderMarkdown(editor.value);
}
```

**New Helper Functions Needed**:

```javascript
async function checkForExternalChanges() {
  try {
    const response = await fetch("/api/content");
    if (!response.ok) return false;

    const payload = await response.json();
    const diskContent = payload.content || "";

    // Has file changed since last save?
    return diskContent !== editorState.lastSavedContent;
  } catch (error) {
    console.error("Failed to check for external changes", error);
    return false; // Assume no conflict on error
  }
}

async function showConflictDialog() {
  // Show custom modal with 3 buttons
  // Returns: Promise that resolves to "save", "discard", or "cancel"

  return new Promise((resolve) => {
    const modal = document.getElementById("conflict-modal");
    const overlay = document.getElementById("conflict-overlay");
    const saveBtn = document.getElementById("conflict-save");
    const discardBtn = document.getElementById("conflict-discard");
    const cancelBtn = document.getElementById("conflict-cancel");

    if (!modal || !overlay || !saveBtn || !discardBtn || !cancelBtn) {
      console.error("Conflict modal elements not found");
      resolve("cancel");
      return;
    }

    // Show modal
    modal.classList.remove("hidden");
    overlay.classList.remove("hidden");

    // Focus first button for keyboard navigation
    saveBtn.focus();

    let choiceMade = false; // Prevent double-click handling

    // Handle button clicks
    const handleChoice = (choice) => {
      if (choiceMade) return; // Ignore if already processing
      choiceMade = true;

      // Hide modal
      modal.classList.add("hidden");
      overlay.classList.add("hidden");

      // Clean up event listeners
      document.removeEventListener("keydown", handleEsc);
      overlay.onclick = null;

      resolve(choice);
    };

    saveBtn.onclick = () => handleChoice("save");
    discardBtn.onclick = () => handleChoice("discard");
    cancelBtn.onclick = () => handleChoice("cancel");

    // ESC key closes modal (same as cancel)
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        handleChoice("cancel");
      }
    };
    document.addEventListener("keydown", handleEsc);

    // Click overlay to cancel
    overlay.onclick = () => handleChoice("cancel");
  });
}
```

---

### 5. Remove Preview Auto-render from Edit Mode

**File**: `markdown_os/static/js/editor.js`

**Function**: `onEditorInput()`

**Current Logic**:
```javascript
function onEditorInput() {
  const editor = document.getElementById("markdown-editor");
  if (!editor) {
    return;
  }

  window.renderMarkdown(editor.value);  // ← Remove this line
  if (editor.value !== editorState.lastSavedContent) {
    setSaveStatus("Unsaved changes");
    queueAutosave();
  }
}
```

**New Logic**:
```javascript
function onEditorInput() {
  const editor = document.getElementById("markdown-editor");
  if (!editor) {
    return;
  }

  // Don't render preview while in edit mode (performance optimization)
  // Preview will render on-demand when switching to Preview tab

  if (editor.value !== editorState.lastSavedContent) {
    setSaveStatus("Unsaved changes");
    queueAutosave();
  }
}
```

---

### 6. Add Conflict Modal HTML Structure

**File**: `markdown_os/static/index.html`

**Add to body** (before closing `</body>` tag):

```html
<!-- Conflict Resolution Modal -->
<div id="conflict-overlay" class="modal-overlay hidden"></div>
<div id="conflict-modal" class="modal hidden">
  <div class="modal-content">
    <h3 class="modal-title">File Modified Externally</h3>
    <p class="modal-message">
      This file was changed externally and you have unsaved changes in the editor.
      What would you like to do?
    </p>
    <div class="modal-actions">
      <button id="conflict-save" class="btn btn-primary" type="button">
        Save My Changes
      </button>
      <button id="conflict-discard" class="btn btn-secondary" type="button">
        Discard My Changes
      </button>
      <button id="conflict-cancel" class="btn btn-tertiary" type="button">
        Cancel
      </button>
    </div>
    <p class="modal-hint">Press ESC or click outside to cancel</p>
  </div>
</div>
```

**Rationale**: Custom modal provides better UX than sequential browser confirms:
- All 3 options visible at once
- Clear visual hierarchy
- Keyboard navigation (ESC to cancel)
- Matches application design

---

### 7. Add Modal CSS Styling

**File**: `markdown_os/static/css/styles.css`

**Add modal styles**:

```css
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 9998;
  transition: opacity 0.2s ease;
}

.modal-overlay.hidden {
  display: none;
}

/* Modal Container */
.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  z-index: 9999;
  max-width: 500px;
  width: 90%;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.modal.hidden {
  display: none;
}

/* Modal Content */
.modal-content {
  padding: 24px;
}

.modal-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.modal-message {
  margin: 0 0 24px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #666;
}

/* Modal Actions */
.modal-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.modal-actions .btn {
  flex: 1;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-actions .btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.modal-actions .btn:active {
  transform: translateY(0);
}

.btn-primary {
  background: #0066cc;
  color: white;
}

.btn-primary:hover {
  background: #0052a3;
}

.btn-secondary {
  background: #dc3545;
  color: white;
}

.btn-secondary:hover {
  background: #b02a37;
}

.btn-tertiary {
  background: #f0f0f0;
  color: #333;
}

.btn-tertiary:hover {
  background: #e0e0e0;
}

/* Modal Hint */
.modal-hint {
  margin: 0;
  font-size: 12px;
  color: #999;
  text-align: center;
}

/* Focus styles for accessibility */
.modal-actions .btn:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Optional: Add fade-in animation for polish */
@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -48%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}

/* Apply animation when modal is shown (remove .hidden class via JS) */
.modal:not(.hidden) {
  animation: modalFadeIn 0.2s ease;
}

.modal-overlay:not(.hidden) {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**Design Notes**:
- Primary button (blue) = Save (most common action)
- Secondary button (red) = Discard (destructive action)
- Tertiary button (gray) = Cancel (safe default)
- Overlay click + ESC key = Cancel
- Smooth transitions and hover effects
- Optional animations for polished feel (can be disabled for simplicity)

---

### 9. UI/UX Considerations

**Status Messages**:
- When auto-reloading in preview mode: "Reloaded from disk" (brief, non-intrusive)
- When auto-reloading in edit mode (no unsaved): "Reloaded from disk"
- When prompting: Update dialog text to mention "unsaved changes"
- When auto-saving on tab switch: Brief "Saving..." → "Saved" (if needed)

**Visual Feedback**:
- Tab highlighting indicates current mode (Edit vs Preview)
- No additional "Read Mode" / "Edit Mode" label needed (keep UI clean)

**Modal Design Philosophy**:
- **Clear hierarchy**: Primary action (Save) is blue/prominent
- **Destructive action**: Discard is red to signal data loss
- **Safe escape**: Cancel is gray, plus ESC key and overlay click
- **Accessibility**: Focus management, keyboard navigation, clear labels
- **Smooth animations**: Fade in/out for professional feel (optional enhancement)
- **Mobile-friendly**: Responsive width, touch-friendly button sizes

**Button Color Meanings**:
- 🔵 Blue (Primary): Safe, non-destructive, recommended action
- 🔴 Red (Secondary): Destructive, data loss warning
- ⚪ Gray (Tertiary): Neutral, cancel, no changes

---

### 10. Edge Cases to Handle

#### 7.1 User is typing when external change arrives
- If `isEditMode = true` and content differs from `lastSavedContent`
- Current debounced save prevents immediate save
- User sees prompt → correct behavior (gives them choice to keep or discard)

#### 7.2 User switches from Edit to Preview while having unsaved changes
- **New behavior**: Check for conflicts, then auto-save or prompt
- If external changes exist: 3-button conflict dialog
- If no external changes: Silent auto-save

#### 7.3 Tab switch interrupted by conflict dialog
- User clicks Preview → conflict dialog appears → they click Cancel
- Should stay in Edit tab with unsaved changes preserved
- Tab UI should remain on Edit tab (no visual glitch)

#### 7.4 Multiple rapid external changes
- Current throttling (0.2s on backend) still applies
- Auto-reload happens for each non-throttled event
- In preview mode: cheap rendering, no issue
- In edit mode: prompts accumulate (browser queues confirm dialogs)
- **Mitigation**: Backend throttling prevents most duplicate events

#### 7.5 WebSocket disconnection
- External changes won't be detected during disconnection
- Current error message: "Realtime sync unavailable"
- Conflict detection on tab switch still works (uses fetch API)
- No change needed

#### 7.6 Save fails during tab switch auto-save
- Network error or disk error during auto-save
- Should show error message and stay in Edit tab
- Don't switch to Preview if save failed
- User can retry tab switch or fix the issue

#### 7.7 Conflict check fails (API error)
- During tab switch, conflict detection API call fails
- Current implementation: Assumes no conflict (safe default)
- Alternative: Could show error and stay in Edit tab
- **Decision**: Proceed with auto-save (optimistic approach)

#### 7.8 User quickly switches Edit → Preview → Edit
- First switch: May trigger auto-save
- Second switch: Should be instant (no unsaved changes)
- Preview renders on-demand during middle state

#### 7.9 Modal button pressed multiple times
- User double-clicks "Save" button
- Should only process first click, modal closes immediately
- Event handler should be removed after first invocation
- **Implementation**: Remove event listeners after choice made

#### 7.10 Modal shown while another modal is open
- Should not happen in current design (no overlapping modals)
- If future features add modals, need z-index management
- **Current**: Not applicable

#### 7.11 User loses focus during modal display
- User switches browser tabs while modal is open
- Modal should remain open when returning
- No auto-close on blur
- **Implementation**: Modal persists until explicit choice made

---

### 11. Testing Considerations

**Manual Tests**:

**Basic Flow:**
1. Open file → should show **Preview tab active** (new default)
2. Edit externally while in preview → should **auto-reload without prompt**
3. Click Edit tab → should enable editing
4. Edit externally while in edit (no unsaved changes) → should **auto-reload without prompt**

**Tab Switching:**
5. Edit in browser, click Preview tab (no external changes) → should **auto-save and switch**
6. Edit in browser, click Preview tab (with external changes) → should show **3-button conflict dialog**
7. In conflict dialog, click "Save" → should save and overwrite external changes
8. In conflict dialog, click "Discard" → should reload from disk
9. In conflict dialog, click "Cancel" → should stay in Edit tab

**External Changes in Edit Mode:**
10. Edit in browser (unsaved), then external change arrives → should show **2-button prompt**
11. Click "Cancel" → should show "External change ignored"
12. Click "OK" → should reload and discard changes

**Preview Rendering:**
13. Type in Edit tab → preview should **NOT render in background**
14. Switch to Preview tab → should render **on-demand**
15. External change while in Preview tab → should render updated content

**Modal Interaction:**
16. Conflict detected → modal and overlay should appear
17. Click "Save My Changes" → should save and switch to Preview
18. Click "Discard My Changes" → should reload from disk and switch to Preview
19. Click "Cancel" → modal closes, stays in Edit tab
20. Press ESC key → modal closes, stays in Edit tab
21. Click overlay (outside modal) → modal closes, stays in Edit tab
22. Modal buttons have proper hover/active states
23. Tab key navigates between modal buttons (accessibility)

**Automated Tests** (optional):
- Mock WebSocket messages in browser tests
- Mock fetch responses for conflict detection
- Verify state transitions and reload logic
- Test all branches of `handleExternalChange()` and `switchToTab()`
- Test modal show/hide behavior
- Test modal button event handlers
- Test modal keyboard interactions (ESC, Tab)

---

### 12. Files to Modify

| File | Changes |
|------|---------|
| `markdown_os/static/js/editor.js` | • Add `isEditMode` state to `editorState`<br>• Update `switchToTab()` with async logic, conflict detection, and auto-save<br>• Rewrite `handleExternalChange()` with smart reload logic<br>• Remove `window.renderMarkdown()` from `onEditorInput()`<br>• Add `checkForExternalChanges()` helper function<br>• Add `showConflictDialog()` helper function with modal handling<br>• Change default tab to preview in DOMContentLoaded |
| `markdown_os/static/index.html` | • Add conflict modal HTML structure (overlay + modal)<br>• Add modal before closing `</body>` tag |
| `markdown_os/static/css/styles.css` | • Add modal overlay styles<br>• Add modal container and content styles<br>• Add button styles (primary/secondary/tertiary)<br>• Add accessibility focus styles |

**No backend changes needed** - all logic and UI is client-side.

---

### 13. Rollout Considerations

**Breaking Changes**:
- Users accustomed to opening directly to edit tab will notice different behavior
- Generally positive change (safer default)

**Documentation Updates**:
- Update README.md to mention read-first behavior
- Update CLAUDE.md with new external change logic

---

## Decisions (All Questions Resolved)

### Q1: Edit Mode Definition ✅
**Decision**: Option A - Edit mode = Edit tab is active
- Switch to Edit tab → `isEditMode = true`
- Switch to Preview tab → `isEditMode = false`
- Simple and matches user mental model

### Q2: Auto-save Before Tab Switch ✅
**Decision**: Option B - Auto-save with conflict detection

When user clicks Preview tab with unsaved changes:
1. Check if file has changed externally since last save
2. **If file changed externally** → Show dialog:
   - Message: "File was changed externally and you have unsaved changes. What do you want to do?"
   - Button 1: "Save my changes (overwrite external)"
   - Button 2: "Discard my changes (load external)"
   - Button 3: "Cancel (stay in edit mode)"
3. **If file hasn't changed** → Auto-save and switch to Preview

**Implementation**:
- Add metadata comparison: compare `lastSavedContent` with current file via API call
- Or: track file modification timestamp from last successful save
- Show 3-button dialog for conflict resolution

### Q3: Visual Indicator for Mode ✅
**Decision**: Keep current tab highlighting - sufficient visual feedback

### Q4: Preview Update Behavior ✅
**Decision**: Only render when Preview tab is active

**New behavior**:
- When in **Edit tab** → typing does NOT trigger preview rendering
- Preview renders only when:
  - User switches to Preview tab (render on-demand)
  - External file changes arrive while Preview tab is active

**Benefits**:
- Better performance (no wasted rendering)
- More efficient for large documents and complex Mermaid diagrams
- Better battery life
- Makes sense for tabbed UI (no benefit to background rendering)

**Implementation**:
- Remove `window.renderMarkdown()` call from `onEditorInput()`
- Add render call to `switchToTab("preview")`
- Keep render call in external change handler when in preview mode

---

## Summary

**Effort**: Medium (frontend logic changes with conflict detection)
**Risk**: Low (client-side only, easy to revert)
**User Impact**: High (better default UX, safer external change handling)

**Key principles**:
1. Be aggressive with auto-reload when safe
2. Prompt only when data loss risk exists
3. Read-first default (safer for casual browsing)
4. Performance optimization (render on-demand)

---

## Implementation Checklist

### Phase 1: Basic Read-First Mode
- [ ] Change default tab from `edit` to `preview` in DOMContentLoaded
- [ ] Add `isEditMode: false` to `editorState`
- [ ] Update `switchToTab()` to set `isEditMode` flag
- [ ] Test: File opens in Preview mode

### Phase 2: Smart External Change Handling
- [ ] Rewrite `handleExternalChange()` with 4-branch logic:
  - [ ] Branch 1: Silent ignore if content identical
  - [ ] Branch 2: Auto-reload in preview mode
  - [ ] Branch 3: Auto-reload in edit mode (no unsaved changes)
  - [ ] Branch 4: Prompt in edit mode (with unsaved changes)
- [ ] Update prompt text to mention "unsaved changes"
- [ ] Test all 4 branches with manual external edits

### Phase 3: Preview Rendering Optimization
- [ ] Remove `window.renderMarkdown()` from `onEditorInput()`
- [ ] Add `await window.renderMarkdown(editor.value)` to `switchToTab("preview")`
- [ ] Ensure external changes still render in preview mode
- [ ] Test: Preview only renders when tab is active

### Phase 4: Build Conflict Resolution Modal
- [ ] Add modal HTML structure to `index.html`
  - [ ] Create overlay element with `#conflict-overlay`
  - [ ] Create modal container with `#conflict-modal`
  - [ ] Add title, message, and hint text
  - [ ] Add 3 buttons: Save, Discard, Cancel
- [ ] Add modal CSS to `styles.css`
  - [ ] Style overlay (backdrop, blur)
  - [ ] Style modal container (positioning, shadow)
  - [ ] Style modal content (padding, typography)
  - [ ] Style buttons (colors, hover, active states)
  - [ ] Add accessibility focus styles
- [ ] Test: Modal displays correctly with all elements visible
- [ ] Test: Modal is hidden by default

### Phase 5: Auto-save on Tab Switch with Conflict Detection
- [ ] Make `switchToTab()` async
- [ ] Add `checkForExternalChanges()` helper function
- [ ] Add `showConflictDialog()` helper function with modal interaction
  - [ ] Show/hide modal and overlay
  - [ ] Wire up button click handlers
  - [ ] Add ESC key handler
  - [ ] Add overlay click handler
  - [ ] Return Promise with user choice
- [ ] Implement auto-save logic before switching to Preview
- [ ] Implement conflict detection and modal trigger
- [ ] Handle all dialog outcomes (save/discard/cancel)
- [ ] Test: Modal appears on conflict
- [ ] Test: All 3 buttons work correctly
- [ ] Test: ESC and overlay click cancel properly

### Phase 6: Edge Case Handling
- [ ] Handle save failures gracefully (stay in Edit tab)
- [ ] Handle conflict check API failures (optimistic save)
- [ ] Ensure tab UI doesn't glitch on dialog cancel
- [ ] Ensure modal closes properly in all scenarios
- [ ] Test rapid tab switching
- [ ] Test modal keyboard navigation

### Phase 7: Testing & Polish
- [ ] Run all manual test scenarios (listed in section 11)
- [ ] Test with large documents (performance)
- [ ] Test with complex Mermaid diagrams
- [ ] Verify WebSocket reconnection still works
- [ ] Update status messages for clarity
- [ ] Test modal accessibility (keyboard, screen readers)
- [ ] Test modal on mobile viewports

### Phase 8: Documentation
- [ ] Update CLAUDE.md with new external change logic
- [ ] Update README.md to mention read-first behavior
- [ ] Document conflict resolution modal behavior
- [ ] Document modal keyboard shortcuts (ESC)

---

## Estimated Timeline

- **Phase 1**: 30 minutes (simple change)
- **Phase 2**: 1 hour (logic rewrite and testing)
- **Phase 3**: 30 minutes (remove + add render calls)
- **Phase 4**: 1.5 hours (modal HTML + CSS)
- **Phase 5**: 2.5 hours (conflict detection, modal interaction, testing)
- **Phase 6**: 1 hour (edge case testing and fixes)
- **Phase 7**: 1.5 hours (comprehensive testing + accessibility)
- **Phase 8**: 30 minutes (documentation)

**Total**: ~9 hours (includes custom modal UI work)

---

## Success Criteria

### Core Functionality
✅ File opens in Preview tab by default (read-first mode)
✅ External changes auto-reload in Preview mode without prompt
✅ External changes auto-reload in Edit mode when no unsaved work
✅ External changes prompt when unsaved work exists in Edit mode
✅ Tab switch auto-saves when no conflicts detected
✅ Tab switch shows conflict modal when external changes detected

### Modal Behavior
✅ Custom modal displays with overlay and backdrop blur
✅ Modal has 3 clearly-labeled buttons (Save/Discard/Cancel)
✅ "Save My Changes" button saves and overwrites external changes
✅ "Discard My Changes" button loads external changes
✅ "Cancel" button closes modal and stays in Edit tab
✅ ESC key closes modal (same as Cancel)
✅ Clicking overlay closes modal (same as Cancel)
✅ Modal prevents double-click issues
✅ Modal focuses first button for keyboard navigation
✅ Modal buttons have visual feedback (hover, active states)

### Performance
✅ Preview only renders when visible (no background rendering)
✅ Large documents switch smoothly between tabs
✅ Mermaid diagrams render on-demand only

### Data Safety
✅ No data loss in any scenario
✅ Unsaved changes preserved when canceling modal
✅ External changes never silently overwritten
✅ Conflict resolution gives user full control

### UX Polish
✅ Smooth transitions and animations (optional)
✅ Appropriate status messages for all actions
✅ Clean, professional modal design
✅ Accessible keyboard navigation
✅ Mobile-responsive modal layout
