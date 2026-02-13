# Markdown-OS Roadmap

Future features organized by effort level. Based on plan.md and current implementation.

---

## 🟢 Low Effort Tasks

### 1. Line Numbers for Code Blocks
- **Value:** Developer-focused feature, improves code readability
- **Implementation:** CSS counter or JS line numbering in markdown.js

Display line numbers alongside code blocks in preview mode. Use CSS counters or dynamically generate line numbers in the markdown renderer. Developers love this for referencing specific lines when discussing code snippets in documentation.

### 2. Math Equations (KaTeX/MathJax)
- **Value:** Scientific/academic writing support
- **Implementation:** Add CDN library, integrate into markdown rendering

Render LaTeX math notation inline and in display mode using KaTeX or MathJax. Add CDN script and parse `$...$` or `$$...$$` blocks during markdown rendering. Scientists, mathematicians, and students can write equations beautifully without external tools.

### 3. Interactive Task Lists
- **Value:** Better note-taking and TODO management
- **Implementation:** Custom markdown parser extension for `[ ]` and `[x]`

Make `- [ ]` and `- [x]` checkbox syntax interactive so users can click to toggle completion. Parse checkboxes during rendering and sync state changes back to the markdown file. Users can manage TODOs directly in their notes without manual editing.

### 4. Markdown Templates
- **Value:** Quick starts for common document types
- **Implementation:** Template directory, insert menu

Pre-built markdown templates for common scenarios (meeting notes, project specs, blog posts). Store templates in a directory and add an "Insert Template" menu. Users save time starting new documents with proper structure already in place.

### 5. Dark Theme / Theme Toggle
- **Value:** High user satisfaction, modern UX expectation
- **Implementation:** CSS variables + toggle switch, localStorage for persistence

Switch between light and dark color schemes with a toggle button. Use CSS custom properties for colors and save preference to localStorage. Users working at night or preferring dark interfaces get eye-strain relief and aesthetic satisfaction.

### 6. Image Paste Support
- **Value:** Convenient image insertion workflow
- **Implementation:** Clipboard API, file upload endpoint, local image storage

Paste images directly from clipboard into the editor. Capture paste events, upload to server, store in local assets folder, insert markdown image syntax. Users can quickly add screenshots and images without saving files manually first.

### 7. Custom CSS Themes
- **Value:** Personalization
- **Implementation:** Theme file loading, CSS overrides

Load custom CSS files to personalize the editor appearance. Add theme selector that applies user-provided CSS files from a themes directory. Power users can craft unique aesthetics matching their workflow and preferences.

### 8. Showcase/Example Command
- **Value:** Onboarding, feature discovery
- **Implementation:** CLI command with template file generation

Add a CLI command like `markdown-os example` that generates a comprehensive example.md file showcasing all editor features. Include examples of Mermaid diagrams, syntax-highlighted code blocks in multiple languages, task lists, tables, blockquotes, and all supported markdown syntax. Users can quickly explore capabilities and use the file as a reference template.

---

## 🟡 Medium Effort Tasks

### 9. File Tree Browser
- **Value:** Essential for working with multiple documents
- **Implementation:** Left sidebar file tree, directory traversal API endpoint

Display a navigable directory tree in a sidebar showing all markdown files in a workspace. Add FastAPI endpoints for directory listing and file switching. Users can manage documentation projects with multiple files without leaving the editor.

### 10. Multiple File Tabs
- **Value:** Essential workflow improvement
- **Implementation:** Tab bar UI, file state management, lazy loading

Open multiple markdown files simultaneously in tabs. Add tab bar component, track open files in state, lazy-load content on tab switch. Users can work on multiple documents side-by-side like a modern IDE or browser.

### 11. Command Palette (Ctrl+P)
- **Value:** Power-user feature, discoverability
- **Implementation:** Fuzzy search modal, keyboard shortcuts registry

Quick-access overlay for commands and file switching with fuzzy search. Build modal with keyboard navigation and action registry. Power users discover features faster and execute commands without memorizing UI locations.

### 12. Snippet System
- **Value:** Productivity boost
- **Implementation:** Snippet registry, trigger keys, expansion

Define reusable text snippets with trigger keywords that expand on typing. Store snippets in config, detect trigger patterns, expand with cursor placement. Users insert boilerplate code, templates, and frequently-used text instantly.

### 13. Export to PDF/HTML
- **Value:** Document sharing, publishing
- **Implementation:** Server-side rendering (Playwright/Puppeteer or WeasyPrint)

Export rendered markdown to PDF or standalone HTML files. Use headless browser or PDF library on server to render and generate files. Users can share polished documents with non-markdown audiences and publish to web.

### 14. Presentation Mode
- **Value:** Slides from markdown (like reveal.js)
- **Implementation:** Split on `---`, fullscreen presentation view

Transform markdown into slideshow presentations with slide separators. Parse document on `---` delimiters, create slide navigation, add fullscreen mode. Users can write talks in markdown and present directly without PowerPoint.

### 15. Git Integration
- **Value:** Version control from editor
- **Implementation:** Python git library, diff viewer, commit UI

View diffs, stage changes, commit, and push without leaving the editor. Use GitPython or similar, add git panel with status/diff views. Developers can version-control their documentation seamlessly within their writing workflow.

### 16. Export to DOCX
- **Value:** Academic/corporate workflows
- **Implementation:** Python-docx or pandoc integration

Export markdown to Microsoft Word format for institutional requirements. Use pandoc or python-docx to convert and format. Users can submit to publishers, collaborate with Word users, and meet corporate formatting standards.

### 17. Unified Navigation (TOC)
- **Value:** Consistent UX across modes
- **Implementation:** Real-time markdown parsing in editor, scroll synchronization

Make the table of contents work in both Edit and Preview modes. Currently TOC only functions in Preview mode. Add real-time parsing of editor textarea content to extract headings, synchronize TOC highlighting with editor scroll position, and make TOC clicks jump to the corresponding line number in the editor. Users get consistent navigation experience regardless of which mode they're working in.

---

## 🔴 High Effort Tasks

### 18. Vim Keybindings
- **Value:** Developer efficiency for Vim users
- **Implementation:** Integrate CodeMirror or Monaco editor with Vim mode

Add modal editing with Vim keybindings (normal, insert, visual modes). Replace textarea with CodeMirror/Monaco configured for Vim. Vim users get their muscle-memory editing flow without leaving the markdown editor.

### 19. WYSIWYG Mode
- **Value:** Typora-like experience, intuitive editing
- **Implementation:** ProseMirror or TipTap editor with markdown serialization

Edit rendered markdown directly without seeing raw syntax. Integrate rich-text editor that round-trips to markdown. Non-technical users get familiar word-processor experience while maintaining plain-text markdown storage.

### 20. LSP Integration for Code Blocks
- **Value:** IDE-like features in markdown
- **Implementation:** Language Server Protocol client, completion UI

Autocomplete, linting, and go-to-definition inside code fences. Connect to language servers for each language, proxy LSP messages. Developers writing code-heavy documentation get IDE intelligence without leaving their notes.

### 21. Plugin System
- **Value:** Community contributions, extensibility
- **Implementation:** Plugin API, sandboxed execution, marketplace

Allow third-party extensions to add features and customize behavior. Design plugin API with hooks, sandbox execution context, create plugin registry. Community can build and share custom features without core codebase changes.

### 22. Live Collaboration
- **Value:** Real-time multi-user editing
- **Implementation:** Operational Transform or CRDT, WebRTC/WebSocket sync

Multiple users editing the same document simultaneously with cursor presence. Implement CRDT or OT for conflict-free merging, sync over WebSocket. Teams can co-author documentation together like Google Docs.

---

## 🎖️ Recommended Starting Points

**Quick Wins:** Tasks #1-8 provide immediate value with minimal development time.

**Most Requested:** Task #5 (Dark Theme) and Task #3 (Interactive Task Lists).

**Transformative:** Tasks #9-10 (File Tree + Tabs) unlock multi-file workflows.

---

## Status Legend
- ✅ Completed
- 🚧 In Progress
- 📋 Planned
- 💡 Proposed
