# Markdown-OS Roadmap

Future features organized by effort level. Based on plan.md and current implementation.

### Already Shipped
PyPI Package Publishing, Table Styling, Line Numbers for Code Blocks, Interactive Task Lists, Dark Theme / Theme Toggle, Showcase/Example Command, Math Equations (KaTeX), Image Paste Support, File Tree Browser, Sidebar & Tab Redesign.

---

## Top 10 Recommended Next Features

| Priority | Feature | Effort | Why |
|----------|---------|--------|-----|
| 1 | Markdown Templates | Low | Partially done (CLI); adding an editor insert menu finishes it |
| 2 | Fullscreen Mermaid Diagrams | Low | svg-pan-zoom already integrated; modal + buttons for exploring complex diagrams |
| 3 | Unified Navigation (TOC) | Medium | TOC already works in Preview; extending to Edit mode completes the UX |
| 4 | Export to PDF/HTML | Medium | Most-requested sharing/publishing feature |
| 5 | Multiple File Tabs | Medium | Pairs with File Tree to unlock real project navigation |
| 6 | Command Palette (Ctrl+P) | Medium | Power-user discoverability; ties together all other features |
| 7 | Custom CSS Themes | Low | Personalization for power users; builds on existing CSS variable system |
| 8 | Snippet System | Medium | Productivity boost for repetitive markdown patterns |
| 9 | Presentation Mode | Medium | Slides from markdown; great for developer talks |
| 10 | Git Integration | Medium | Version control from editor; natural fit for dev workflows |

---

## Low Effort

### 1. Markdown Templates
- **Value:** Quick starts for common document types
- **Implementation:** Template directory, insert menu in editor UI

The CLI `example` command already generates a showcase template. Extend this with an in-editor "Insert Template" menu offering templates for meeting notes, project specs, blog posts, etc. Store templates in the bundled templates directory. Users save time starting new documents with proper structure already in place.

### 2. Custom CSS Themes
- **Value:** Personalization
- **Implementation:** Theme file loading, CSS overrides

Load custom CSS files to personalize the editor appearance. Add theme selector that applies user-provided CSS files from a themes directory. The existing CSS variable system makes this straightforward. Power users can craft unique aesthetics matching their workflow and preferences.

### 3. Fullscreen Mermaid Diagrams
- **Value:** Readable, explorable diagrams without squinting or horizontal scrolling
- **Implementation:** Modal overlay with svg-pan-zoom integration and zoom control buttons

Add a fullscreen button to each rendered Mermaid diagram that opens it in a centered modal overlay. The modal includes +/− zoom buttons and retains mouse/trackpad pan and scroll-to-zoom via the existing svg-pan-zoom library. Users can explore complex diagrams at full viewport size, zoom into specific sections with button or gesture controls, and dismiss the modal to return to their document.

---

## Medium Effort

### 4. Unified Navigation (TOC)
- **Value:** Consistent UX across modes
- **Implementation:** Real-time markdown parsing in editor, scroll synchronization

Make the table of contents work in both Edit and Preview modes. Currently TOC only functions in Preview mode. Add real-time parsing of editor textarea content to extract headings, synchronize TOC highlighting with editor scroll position, and make TOC clicks jump to the corresponding line number in the editor. Users get consistent navigation experience regardless of which mode they're working in.

### 5. Multiple File Tabs
- **Value:** Essential workflow improvement
- **Implementation:** Tab bar UI, file state management, lazy loading

Open multiple markdown files simultaneously in tabs. Add tab bar component, track open files in state, lazy-load content on tab switch. Users can work on multiple documents side-by-side like a modern IDE or browser.

### 6. Command Palette (Ctrl+P)
- **Value:** Power-user feature, discoverability
- **Implementation:** Fuzzy search modal, keyboard shortcuts registry

Quick-access overlay for commands and file switching with fuzzy search. Build modal with keyboard navigation and action registry. Power users discover features faster and execute commands without memorizing UI locations.

### 7. Snippet System
- **Value:** Productivity boost
- **Implementation:** Snippet registry, trigger keys, expansion

Define reusable text snippets with trigger keywords that expand on typing. Store snippets in config, detect trigger patterns, expand with cursor placement. Users insert boilerplate code, templates, and frequently-used text instantly.

### 8. Export to PDF/HTML
- **Value:** Document sharing, publishing
- **Implementation:** Server-side rendering (Playwright/Puppeteer or WeasyPrint)

Export rendered markdown to PDF or standalone HTML files. Use headless browser or PDF library on server to render and generate files. Users can share polished documents with non-markdown audiences and publish to web.

### 9. Presentation Mode
- **Value:** Slides from markdown (like reveal.js)
- **Implementation:** Split on `---`, fullscreen presentation view

Transform markdown into slideshow presentations with slide separators. Parse document on `---` delimiters, create slide navigation, add fullscreen mode. Users can write talks in markdown and present directly without PowerPoint.

### 10. Git Integration
- **Value:** Version control from editor
- **Implementation:** Python git library, diff viewer, commit UI

View diffs, stage changes, commit, and push without leaving the editor. Use GitPython or similar, add git panel with status/diff views. Developers can version-control their documentation seamlessly within their writing workflow.

### 11. Export to DOCX
- **Value:** Academic/corporate workflows
- **Implementation:** Python-docx or pandoc integration

Export markdown to Microsoft Word format for institutional requirements. Use pandoc or python-docx to convert and format. Users can submit to publishers, collaborate with Word users, and meet corporate formatting standards.

---

## High Effort

### 12. Vim Keybindings
- **Value:** Developer efficiency for Vim users
- **Implementation:** Integrate CodeMirror or Monaco editor with Vim mode

Add modal editing with Vim keybindings (normal, insert, visual modes). Replace textarea with CodeMirror/Monaco configured for Vim. Vim users get their muscle-memory editing flow without leaving the markdown editor.

### 13. WYSIWYG Mode
- **Value:** Typora-like experience, intuitive editing
- **Implementation:** ProseMirror or TipTap editor with markdown serialization

Edit rendered markdown directly without seeing raw syntax. Integrate rich-text editor that round-trips to markdown. Non-technical users get familiar word-processor experience while maintaining plain-text markdown storage.

### 14. LSP Integration for Code Blocks
- **Value:** IDE-like features in markdown
- **Implementation:** Language Server Protocol client, completion UI

Autocomplete, linting, and go-to-definition inside code fences. Connect to language servers for each language, proxy LSP messages. Developers writing code-heavy documentation get IDE intelligence without leaving their notes.

### 15. Plugin System
- **Value:** Community contributions, extensibility
- **Implementation:** Plugin API, sandboxed execution, marketplace

Allow third-party extensions to add features and customize behavior. Design plugin API with hooks, sandbox execution context, create plugin registry. Community can build and share custom features without core codebase changes.

### 16. Live Collaboration
- **Value:** Real-time multi-user editing
- **Implementation:** Operational Transform or CRDT, WebRTC/WebSocket sync

Multiple users editing the same document simultaneously with cursor presence. Implement CRDT or OT for conflict-free merging, sync over WebSocket. Teams can co-author documentation together like Google Docs.

---

## Future Considerations

Ideas worth exploring but lower priority than the roadmap above. These may become more feasible as the project matures.

### 17. Outline Mode in Edit
- **Value:** Better document structure awareness while editing
- **Implementation:** Real-time outline panel showing heading hierarchy with expand/collapse

Display a dynamic outline panel in the sidebar showing the document's heading structure while in Edit mode. Users can expand/collapse sections and click to navigate, similar to IDE outline features. This provides structure visibility without switching to Preview mode, helping users maintain context in large documents and understand document organization at a glance.

### 18. Keyboard Navigation for TOC
- **Value:** Power-user efficiency, accessibility
- **Implementation:** Arrow keys to navigate TOC items, Enter to follow links, Tab to reach TOC

Make the table of contents fully keyboard-navigable using arrow keys to move between items and Enter to jump to headings. Users can reach and navigate the TOC with Tab from any element, improving accessibility and providing a keyboard-driven alternative to mouse navigation. This particularly benefits developers and keyboard-first users.

