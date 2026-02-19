# Markdown-OS Roadmap

Future features organized by effort level.

### Already Shipped
PyPI Package Publishing, Table Styling, Line Numbers for Code Blocks, Interactive Task Lists, Dark Theme / Theme Toggle, Showcase/Example Command, Math Equations (KaTeX), Image Paste Support, File Tree Browser, Sidebar & Tab Redesign, Fullscreen Mermaid Diagrams, Multi-Theme Support (Dracula, Nord, Lofi), Unified Navigation (TOC in Edit + Preview), Multiple File Tabs.

---

## Recommended Next Features

| Priority | Feature | Effort | Why |
|----------|---------|--------|-----|
| 1 | Markdown Templates | Low | Partially done (CLI); adding an editor insert menu finishes it |
| 2 | Export to PDF/HTML | Medium | Most-requested sharing/publishing feature |
| 3 | Command Palette (Ctrl+P) | Medium | Power-user discoverability; ties together all other features |
| 4 | Snippet System | Medium | Productivity boost for repetitive markdown patterns |
| 5 | Presentation Mode | Medium | Slides from markdown; great for developer talks |
| 6 | Git Integration | Medium | Version control from editor; natural fit for dev workflows |

---

## Low Effort

### 1. Markdown Templates
- **Value:** Quick starts for common document types
- **Implementation:** Template directory, insert menu in editor UI

The CLI `example` command already generates a showcase template. Extend this with an in-editor "Insert Template" menu offering templates for meeting notes, project specs, blog posts, etc. Store templates in the bundled templates directory. Users save time starting new documents with proper structure already in place.

---

## Medium Effort

### 2. Export to PDF/HTML
- **Value:** Document sharing, publishing
- **Implementation:** Server-side rendering (Playwright/Puppeteer or WeasyPrint)

Export rendered markdown to PDF or standalone HTML files. Use headless browser or PDF library on server to render and generate files. Users can share polished documents with non-markdown audiences and publish to web.

### 3. Command Palette (Ctrl+P)
- **Value:** Power-user feature, discoverability
- **Implementation:** Fuzzy search modal, keyboard shortcuts registry

Quick-access overlay for commands and file switching with fuzzy search. Build modal with keyboard navigation and action registry. Power users discover features faster and execute commands without memorizing UI locations.

### 4. Snippet System
- **Value:** Productivity boost
- **Implementation:** Snippet registry, trigger keys, expansion

Define reusable text snippets with trigger keywords that expand on typing. Store snippets in config, detect trigger patterns, expand with cursor placement. Users insert boilerplate code, templates, and frequently-used text instantly.

### 5. Presentation Mode
- **Value:** Slides from markdown (like reveal.js)
- **Implementation:** Split on `---`, fullscreen presentation view

Transform markdown into slideshow presentations with slide separators. Parse document on `---` delimiters, create slide navigation, add fullscreen mode. Users can write talks in markdown and present directly without PowerPoint.

### 6. Git Integration
- **Value:** Version control from editor
- **Implementation:** Python git library, diff viewer, commit UI

View diffs, stage changes, commit, and push without leaving the editor. Use GitPython or similar, add git panel with status/diff views. Developers can version-control their documentation seamlessly within their writing workflow.

### 7. Export to DOCX
- **Value:** Academic/corporate workflows
- **Implementation:** Python-docx or pandoc integration

Export markdown to Microsoft Word format for institutional requirements. Use pandoc or python-docx to convert and format. Users can submit to publishers, collaborate with Word users, and meet corporate formatting standards.

---

## High Effort

### 8. Vim Keybindings
- **Value:** Developer efficiency for Vim users
- **Implementation:** Integrate CodeMirror or Monaco editor with Vim mode

Add modal editing with Vim keybindings (normal, insert, visual modes). Replace textarea with CodeMirror/Monaco configured for Vim. Vim users get their muscle-memory editing flow without leaving the markdown editor.

### 9. WYSIWYG Mode
- **Value:** Typora-like experience, intuitive editing
- **Implementation:** ProseMirror or TipTap editor with markdown serialization

Edit rendered markdown directly without seeing raw syntax. Integrate rich-text editor that round-trips to markdown. Non-technical users get familiar word-processor experience while maintaining plain-text markdown storage.

### 10. LSP Integration for Code Blocks
- **Value:** IDE-like features in markdown
- **Implementation:** Language Server Protocol client, completion UI

Autocomplete, linting, and go-to-definition inside code fences. Connect to language servers for each language, proxy LSP messages. Developers writing code-heavy documentation get IDE intelligence without leaving their notes.

### 11. Plugin System
- **Value:** Community contributions, extensibility
- **Implementation:** Plugin API, sandboxed execution, marketplace

Allow third-party extensions to add features and customize behavior. Design plugin API with hooks, sandbox execution context, create plugin registry. Community can build and share custom features without core codebase changes.

### 12. Live Collaboration
- **Value:** Real-time multi-user editing
- **Implementation:** Operational Transform or CRDT, WebRTC/WebSocket sync

Multiple users editing the same document simultaneously with cursor presence. Implement CRDT or OT for conflict-free merging, sync over WebSocket. Teams can co-author documentation together like Google Docs.

---

## Future Considerations

Ideas worth exploring but lower priority than the roadmap above. These may become more feasible as the project matures.

### Outline Mode in Edit
- **Value:** Better document structure awareness while editing
- **Implementation:** Real-time outline panel showing heading hierarchy with expand/collapse

Display a dynamic outline panel in the sidebar showing the document's heading structure while in Edit mode. Users can expand/collapse sections and click to navigate, similar to IDE outline features. This provides structure visibility without switching to Preview mode, helping users maintain context in large documents and understand document organization at a glance.

### Keyboard Navigation for TOC
- **Value:** Power-user efficiency, accessibility
- **Implementation:** Arrow keys to navigate TOC items, Enter to follow links, Tab to reach TOC

Make the table of contents fully keyboard-navigable using arrow keys to move between items and Enter to jump to headings. Users can reach and navigate the TOC with Tab from any element, improving accessibility and providing a keyboard-driven alternative to mouse navigation. This particularly benefits developers and keyboard-first users.
