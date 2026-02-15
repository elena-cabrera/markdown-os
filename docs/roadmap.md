# Markdown-OS Roadmap

Future features organized by effort level. Based on plan.md and current implementation.

### Already Shipped
PyPI Package Publishing, Table Styling, Line Numbers for Code Blocks, Interactive Task Lists, Dark Theme / Theme Toggle, Showcase/Example Command.

---

## Top 10 Recommended Next Features

| Priority | Feature | Effort | Why |
|----------|---------|--------|-----|
| 1 | Math Equations (KaTeX) | Low | One CDN + a few lines of renderer code; opens up scientific/academic users |
| 2 | Image Paste Support | Low | High-impact UX win for anyone adding screenshots to docs |
| 3 | Markdown Templates | Low | Partially done (CLI); adding an editor insert menu finishes it |
| 4 | Unified Navigation (TOC) | Medium | TOC already works in Preview; extending to Edit mode completes the UX |
| 5 | File Tree Browser | Medium | Essential step toward multi-file workflows |
| 6 | Export to PDF/HTML | Medium | Most-requested sharing/publishing feature |
| 7 | Multiple File Tabs | Medium | Pairs with File Tree to unlock real project navigation |
| 8 | Command Palette (Ctrl+P) | Medium | Power-user discoverability; ties together all other features |
| 9 | Custom CSS Themes | Low | Personalization for power users; builds on existing CSS variable system |
| 10 | Snippet System | Medium | Productivity boost for repetitive markdown patterns |

---

## Low Effort

### 1. Math Equations (KaTeX/MathJax)
- **Value:** Scientific/academic writing support
- **Implementation:** Add CDN library, integrate into markdown rendering

Render LaTeX math notation inline and in display mode using KaTeX or MathJax. Add CDN script and parse `$...$` or `$$...$$` blocks during markdown rendering. Scientists, mathematicians, and students can write equations beautifully without external tools.

### 2. Image Paste Support
- **Value:** Convenient image insertion workflow
- **Implementation:** Clipboard API, file upload endpoint, local image storage

Paste images directly from clipboard into the editor. Capture paste events, upload to server, store in local assets folder, insert markdown image syntax. Users can quickly add screenshots and images without saving files manually first.

### 3. Markdown Templates
- **Value:** Quick starts for common document types
- **Implementation:** Template directory, insert menu in editor UI

The CLI `example` command already generates a showcase template. Extend this with an in-editor "Insert Template" menu offering templates for meeting notes, project specs, blog posts, etc. Store templates in the bundled templates directory. Users save time starting new documents with proper structure already in place.

### 4. Custom CSS Themes
- **Value:** Personalization
- **Implementation:** Theme file loading, CSS overrides

Load custom CSS files to personalize the editor appearance. Add theme selector that applies user-provided CSS files from a themes directory. The existing CSS variable system makes this straightforward. Power users can craft unique aesthetics matching their workflow and preferences.

---

## Medium Effort

### 5. Unified Navigation (TOC)
- **Value:** Consistent UX across modes
- **Implementation:** Real-time markdown parsing in editor, scroll synchronization

Make the table of contents work in both Edit and Preview modes. Currently TOC only functions in Preview mode. Add real-time parsing of editor textarea content to extract headings, synchronize TOC highlighting with editor scroll position, and make TOC clicks jump to the corresponding line number in the editor. Users get consistent navigation experience regardless of which mode they're working in.

### 6. File Tree Browser
- **Value:** Essential for working with multiple documents
- **Implementation:** Left sidebar file tree, directory traversal API endpoint

Display a navigable directory tree in a sidebar showing all markdown files in a workspace. Add FastAPI endpoints for directory listing and file switching. Users can manage documentation projects with multiple files without leaving the editor.

### 7. Multiple File Tabs
- **Value:** Essential workflow improvement
- **Implementation:** Tab bar UI, file state management, lazy loading

Open multiple markdown files simultaneously in tabs. Add tab bar component, track open files in state, lazy-load content on tab switch. Users can work on multiple documents side-by-side like a modern IDE or browser.

### 8. Command Palette (Ctrl+P)
- **Value:** Power-user feature, discoverability
- **Implementation:** Fuzzy search modal, keyboard shortcuts registry

Quick-access overlay for commands and file switching with fuzzy search. Build modal with keyboard navigation and action registry. Power users discover features faster and execute commands without memorizing UI locations.

### 9. Snippet System
- **Value:** Productivity boost
- **Implementation:** Snippet registry, trigger keys, expansion

Define reusable text snippets with trigger keywords that expand on typing. Store snippets in config, detect trigger patterns, expand with cursor placement. Users insert boilerplate code, templates, and frequently-used text instantly.

### 10. Export to PDF/HTML
- **Value:** Document sharing, publishing
- **Implementation:** Server-side rendering (Playwright/Puppeteer or WeasyPrint)

Export rendered markdown to PDF or standalone HTML files. Use headless browser or PDF library on server to render and generate files. Users can share polished documents with non-markdown audiences and publish to web.

### 11. Presentation Mode
- **Value:** Slides from markdown (like reveal.js)
- **Implementation:** Split on `---`, fullscreen presentation view

Transform markdown into slideshow presentations with slide separators. Parse document on `---` delimiters, create slide navigation, add fullscreen mode. Users can write talks in markdown and present directly without PowerPoint.

### 12. Git Integration
- **Value:** Version control from editor
- **Implementation:** Python git library, diff viewer, commit UI

View diffs, stage changes, commit, and push without leaving the editor. Use GitPython or similar, add git panel with status/diff views. Developers can version-control their documentation seamlessly within their writing workflow.

### 13. Export to DOCX
- **Value:** Academic/corporate workflows
- **Implementation:** Python-docx or pandoc integration

Export markdown to Microsoft Word format for institutional requirements. Use pandoc or python-docx to convert and format. Users can submit to publishers, collaborate with Word users, and meet corporate formatting standards.

---

## High Effort

### 14. Vim Keybindings
- **Value:** Developer efficiency for Vim users
- **Implementation:** Integrate CodeMirror or Monaco editor with Vim mode

Add modal editing with Vim keybindings (normal, insert, visual modes). Replace textarea with CodeMirror/Monaco configured for Vim. Vim users get their muscle-memory editing flow without leaving the markdown editor.

### 15. WYSIWYG Mode
- **Value:** Typora-like experience, intuitive editing
- **Implementation:** ProseMirror or TipTap editor with markdown serialization

Edit rendered markdown directly without seeing raw syntax. Integrate rich-text editor that round-trips to markdown. Non-technical users get familiar word-processor experience while maintaining plain-text markdown storage.

### 16. LSP Integration for Code Blocks
- **Value:** IDE-like features in markdown
- **Implementation:** Language Server Protocol client, completion UI

Autocomplete, linting, and go-to-definition inside code fences. Connect to language servers for each language, proxy LSP messages. Developers writing code-heavy documentation get IDE intelligence without leaving their notes.

### 17. Plugin System
- **Value:** Community contributions, extensibility
- **Implementation:** Plugin API, sandboxed execution, marketplace

Allow third-party extensions to add features and customize behavior. Design plugin API with hooks, sandbox execution context, create plugin registry. Community can build and share custom features without core codebase changes.

### 18. Live Collaboration
- **Value:** Real-time multi-user editing
- **Implementation:** Operational Transform or CRDT, WebRTC/WebSocket sync

Multiple users editing the same document simultaneously with cursor presence. Implement CRDT or OT for conflict-free merging, sync over WebSocket. Teams can co-author documentation together like Google Docs.
