# Markdown-OS Implementation Plan

## Project Overview

**Markdown-OS** is a developer-focused, CLI-driven markdown editor that runs as a local web server. It provides an enhanced markdown viewing and editing experience with features like Mermaid diagrams, syntax highlighting, and auto-saving.

**Vision**: Open-source, web-based alternative to Typora with a developer-first approach.

## Tech Stack

### Backend
- **Python 3.11+**: Core language
- **FastAPI**: Web server framework (async, modern, fast)
- **Typer**: CLI interface
- **Uvicorn**: ASGI server for FastAPI
- **Watchdog**: File system monitoring (for auto-reload)

### Frontend
- **Vanilla HTML/CSS/JavaScript**: No framework overhead
- **Marked.js**: Markdown parsing and rendering
- **Mermaid.js**: Diagram rendering
- **svg-pan-zoom**: Interactive diagram zooming
- **highlight.js**: Code syntax highlighting

---

## MVP Feature Set

### Core Features (Phase 1)
1. ✅ CLI command: `markdown-os open <filename.md>`
2. ✅ Local web server startup
3. ✅ Markdown rendering
4. ✅ Mermaid diagram support with zoom capability
5. ✅ Syntax highlighting for code blocks
6. ✅ Code block enhancements: copy button and language label
7. ✅ Auto-generated table of contents (left sidebar)
8. ✅ Auto-saving edits back to file
9. ✅ Tabbed interface (switch between edit/preview modes)

### Future Enhancements (Post-MVP)
- Multiple file tabs
- File tree browser
- Dark theme / theme toggle
- Line numbers for code blocks
- Vim keybindings
- Git integration (show diff, commit from editor)
- LSP integration for code blocks
- Custom themes
- Plugin system

---

## Architecture

### High-Level Flow
```
User runs CLI → Typer parses command → FastAPI server starts → Browser opens
                                          ↓
User edits in browser → WebSocket connection → Server saves to disk
```

### Directory Structure
```
markdown-os/
├── pyproject.toml              # uv/pip configuration
├── README.md                   # Project documentation
├── plan.md                     # This file
├── markdown_os/                # Main package
│   ├── __init__.py
│   ├── cli.py                  # Typer CLI entrypoint
│   ├── server.py               # FastAPI application
│   ├── file_handler.py         # File read/write operations
│   ├── static/                 # Frontend assets
│   │   ├── index.html          # Main HTML template
│   │   ├── css/
│   │   │   └── styles.css      # Main stylesheet
│   │   └── js/
│   │       ├── editor.js       # Editor logic
│   │       ├── markdown.js     # Markdown rendering
│   │       ├── toc.js          # Table of contents generator
│   │       └── websocket.js    # WebSocket client
│   └── templates/              # Jinja2 templates (if needed)
└── tests/                      # Test suite
    ├── test_cli.py
    ├── test_server.py
    └── test_file_handler.py
```

---

## Implementation Phases

## Phase 1: Project Setup & CLI Foundation

### 1.1 Project Initialization
- [ ] Update `pyproject.toml` with dependencies (using uv):
  - `fastapi`
  - `uvicorn[standard]`
  - `typer`
  - `watchdog`
  - `python-multipart`
  - `websockets`
- [ ] Set up entry point for CLI command
- [ ] Initialize git repository (if not done)

### 1.2 Basic CLI Structure
**File**: `markdown_os/cli.py`

```python
import typer
from pathlib import Path

app = typer.Typer()

@app.command()
def open(filepath: Path):
    """Open a markdown file in the browser"""
    # Validate file exists
    # Start FastAPI server on port 8000 (auto-increment if occupied)
    # Open browser automatically
```

**Tasks**:
- [ ] Implement file path validation
- [ ] Add error handling for non-existent files
- [ ] Implement port auto-increment logic (8000, 8001, 8002...)
- [ ] Implement auto-browser opening with `webbrowser` module

---

## Phase 2: FastAPI Server Setup

### 2.1 Basic Server Structure
**File**: `markdown_os/server.py`

```python
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    """Serve the main HTML page"""
    pass

@app.get("/api/content")
async def get_content():
    """Return the markdown file content"""
    pass

@app.post("/api/save")
async def save_content(content: str):
    """Save markdown content to file"""
    pass

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time communication"""
    pass
```

**Tasks**:
- [ ] Create FastAPI app with proper CORS if needed
- [ ] Implement file content endpoint (GET)
- [ ] Implement save endpoint (POST)
- [ ] Set up WebSocket connection for live updates
- [ ] Add graceful shutdown handler

### 2.2 File Handler
**File**: `markdown_os/file_handler.py`

```python
from pathlib import Path
from typing import Optional

class FileHandler:
    def __init__(self, filepath: Path):
        self.filepath = filepath

    def read(self) -> str:
        """Read file content"""
        pass

    def write(self, content: str) -> bool:
        """Write content to file"""
        pass

    def get_metadata(self) -> dict:
        """Get file metadata (size, modified time, etc.)"""
        pass
```

**Tasks**:
- [ ] Implement safe file reading with UTF-8 encoding
- [ ] Implement atomic file writing (write to temp, then rename)
- [ ] Add file locking to prevent concurrent writes
- [ ] Add error handling for permissions, disk space, etc.

---

## Phase 3: Frontend - Basic HTML Structure

### 3.1 Main HTML Template
**File**: `markdown_os/static/index.html`

**Structure**:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Markdown-OS</title>
    <link rel="stylesheet" href="/static/css/styles.css">
    <!-- External libraries -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
</head>
<body>
    <div class="container">
        <!-- Table of Contents Sidebar -->
        <aside id="toc-sidebar">
            <h3>Contents</h3>
            <nav id="toc"></nav>
        </aside>

        <!-- Main Content Area -->
        <main id="main-content">
            <!-- Tab Navigation -->
            <div class="tab-nav">
                <button id="edit-tab" class="tab-button active">Edit</button>
                <button id="preview-tab" class="tab-button">Preview</button>
                <span id="save-status"></span>
            </div>

            <!-- Editor View -->
            <div id="editor-container" class="view active">
                <textarea id="markdown-editor"></textarea>
            </div>

            <!-- Preview View -->
            <div id="preview-container" class="view">
                <div id="markdown-preview"></div>
            </div>
        </main>
    </div>

    <script src="/static/js/websocket.js"></script>
    <script src="/static/js/markdown.js"></script>
    <script src="/static/js/toc.js"></script>
    <script src="/static/js/editor.js"></script>
</body>
</html>
```

**Tasks**:
- [ ] Create responsive layout (TOC sidebar + main area)
- [ ] Set up tabbed interface with Edit/Preview toggle
- [ ] Set up editor and preview containers with visibility toggle
- [ ] Add save status indicator in tab navigation
- [ ] Add loading states
- [ ] Include all required CDN links (using light theme for highlight.js)

---

## Phase 4: Frontend - Core Functionality

### 4.1 Markdown Rendering
**File**: `markdown_os/static/js/markdown.js`

**Responsibilities**:
- Parse markdown to HTML using Marked.js
- Configure Marked.js options:
  - Enable GFM (GitHub Flavored Markdown)
  - Enable tables, strikethrough, etc.
- Render mermaid diagrams
- Apply syntax highlighting to code blocks

**Key Functions**:
```javascript
// Configure marked
marked.setOptions({
    highlight: function(code, lang) {
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
});

// Render markdown
function renderMarkdown(content) {
    const html = marked.parse(content);
    const preview = document.getElementById('markdown-preview');
    preview.innerHTML = html;

    // Render mermaid diagrams
    renderMermaidDiagrams();

    // Apply zoom to diagrams
    applyZoomToDiagrams();
}

// Mermaid diagram rendering
function renderMermaidDiagrams() {
    const mermaidBlocks = document.querySelectorAll('code.language-mermaid');
    mermaidBlocks.forEach(block => {
        // Convert to mermaid diagram
    });
}

// Apply svg-pan-zoom to mermaid diagrams
function applyZoomToDiagrams() {
    const svgs = document.querySelectorAll('.mermaid svg');
    svgs.forEach(svg => {
        svgPanZoom(svg, {
            controlIconsEnabled: true,
            zoomScaleSensitivity: 0.5
        });
    });
}
```

**Tasks**:
- [ ] Set up Marked.js with proper configuration
- [ ] Integrate highlight.js for code blocks
- [ ] Add copy button to code blocks
- [ ] Add language label to code blocks
- [ ] Implement mermaid diagram detection and rendering
- [ ] Apply svg-pan-zoom to all mermaid SVGs
- [ ] Add error handling for invalid mermaid syntax

### 4.2 Table of Contents Generator
**File**: `markdown_os/static/js/toc.js`

**Responsibilities**:
- Extract headings (h1-h6) from rendered HTML
- Build hierarchical TOC structure
- Add click handlers for smooth scrolling
- Highlight current section as user scrolls

**Key Functions**:
```javascript
function generateTOC() {
    const preview = document.getElementById('markdown-preview');
    const headings = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const toc = document.getElementById('toc');

    // Build nested list structure
    const tocHTML = buildTOCTree(headings);
    toc.innerHTML = tocHTML;

    // Add smooth scroll behavior
    addTOCClickHandlers();
}

function buildTOCTree(headings) {
    // Create nested <ul>/<li> structure based on heading levels
}

function addTOCClickHandlers() {
    // Add click handlers for smooth scrolling
}

function updateActiveTOCItem() {
    // Highlight current section based on scroll position
}
```

**Tasks**:
- [ ] Extract headings and build TOC tree
- [ ] Add smooth scrolling to headings
- [ ] Implement active section highlighting
- [ ] Handle nested heading levels correctly
- [ ] Add ID attributes to headings for anchor links

### 4.3 Editor & Auto-save
**File**: `markdown_os/static/js/editor.js`

**Responsibilities**:
- Load initial markdown content
- Handle tab switching between Edit and Preview modes
- Detect changes in editor
- Debounce auto-save (e.g., 1 second after last edit)
- Send save requests to server
- Handle save success/failure feedback

**Key Functions**:
```javascript
let saveTimeout = null;
const AUTOSAVE_DELAY = 1000; // ms

// Load initial content
async function loadContent() {
    const response = await fetch('/api/content');
    const data = await response.json();
    const editor = document.getElementById('markdown-editor');
    editor.value = data.content;

    // Initial render
    renderMarkdown(data.content);
    generateTOC();
}

// Auto-save with debouncing
function onEditorChange() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await saveContent();
    }, AUTOSAVE_DELAY);

    // Render preview immediately
    const content = editor.value;
    renderMarkdown(content);
    generateTOC();
}

// Save to server
async function saveContent() {
    const editor = document.getElementById('markdown-editor');
    const content = editor.value;

    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            showSaveStatus('Saved');
        } else {
            showSaveStatus('Save failed', true);
        }
    } catch (error) {
        showSaveStatus('Save error', true);
    }
}

// Tab switching
function switchToTab(tabName) {
    const editTab = document.getElementById('edit-tab');
    const previewTab = document.getElementById('preview-tab');
    const editorContainer = document.getElementById('editor-container');
    const previewContainer = document.getElementById('preview-container');

    if (tabName === 'edit') {
        editTab.classList.add('active');
        previewTab.classList.remove('active');
        editorContainer.classList.add('active');
        previewContainer.classList.remove('active');
    } else {
        editTab.classList.remove('active');
        previewTab.classList.add('active');
        editorContainer.classList.remove('active');
        previewContainer.classList.add('active');

        // Update preview when switching to preview tab
        const editor = document.getElementById('markdown-editor');
        renderMarkdown(editor.value);
        generateTOC();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadContent();

    const editor = document.getElementById('markdown-editor');
    editor.addEventListener('input', onEditorChange);

    // Set up tab navigation
    document.getElementById('edit-tab').addEventListener('click', () => switchToTab('edit'));
    document.getElementById('preview-tab').addEventListener('click', () => switchToTab('preview'));
});
```

**Tasks**:
- [ ] Implement content loading from server
- [ ] Implement tab switching between Edit and Preview
- [ ] Set up editor change detection
- [ ] Implement debounced auto-save
- [ ] Add save status indicator (e.g., "Saving...", "Saved")
- [ ] Handle save errors gracefully
- [ ] Update preview when switching to preview tab

### 4.4 WebSocket Connection
**File**: `markdown_os/static/js/websocket.js`

**Purpose**: Enable real-time updates if file is modified externally

**Key Functions**:
```javascript
let ws = null;

function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8000/ws');

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'file_changed') {
            // Prompt user to reload content
            handleExternalChange(data.content);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        // Attempt reconnection
        setTimeout(connectWebSocket, 3000);
    };
}

function handleExternalChange(newContent) {
    // Show notification: "File changed externally. Reload?"
    // If user confirms, update editor with new content
}
```

**Tasks**:
- [ ] Set up WebSocket connection
- [ ] Handle file change notifications
- [ ] Implement user prompt for external changes
- [ ] Add reconnection logic
- [ ] Handle connection errors gracefully

---

## Phase 5: Styling

### 5.1 CSS Implementation
**File**: `markdown_os/static/css/styles.css`

**Key Sections**:
1. **Layout**: Flexbox/Grid for sidebar + main content
2. **TOC Sidebar**: Fixed width, scrollable, styled list
3. **Tab Navigation**: Clean, intuitive tab buttons with active state
4. **Editor**: Monospace font, comfortable padding, full-height textarea
5. **Preview**: Readable typography, proper spacing for markdown elements
6. **Code Blocks**: Copy button styling, language label positioning
7. **Mermaid Diagrams**: Container styling, zoom controls
8. **Light Theme**: Clean, professional color scheme
9. **Responsive Design**: Mobile-friendly (optional for MVP)

**Tasks**:
- [ ] Create layout with TOC sidebar (20-25% width) and main area (75-80% width)
- [ ] Style TOC with hierarchy indentation
- [ ] Style tab navigation with active/inactive states
- [ ] Style editor with monospace font and line height
- [ ] Style preview with readable typography (font size, line height, max-width)
- [ ] Style code blocks with copy button and language label
- [ ] Apply light theme color scheme (professional, clean)
- [ ] Add syntax highlighting theme integration (light theme)
- [ ] Style save status indicator
- [ ] Add smooth transitions and hover effects
- [ ] Handle view visibility toggling (.view.active)

---

## Phase 6: Testing & Refinement

### 6.1 Testing Strategy

**Unit Tests**:
- [ ] Test file handler (read, write, error cases)
- [ ] Test CLI argument parsing
- [ ] Test server endpoints

**Integration Tests**:
- [ ] Test full flow: CLI → server → file operations
- [ ] Test WebSocket communication
- [ ] Test concurrent file access

**Manual Testing**:
- [ ] Test with various markdown files (simple, complex, large)
- [ ] Test mermaid diagrams of different types
- [ ] Test auto-save with different delay intervals
- [ ] Test external file changes
- [ ] Test error scenarios (permissions, disk space, invalid markdown)

### 6.2 Edge Cases to Handle
- [ ] File already open in another instance
- [ ] File deleted while editor is open
- [ ] File permissions changed during editing
- [ ] Very large files (>10MB)
- [ ] Binary files accidentally passed
- [ ] Malformed mermaid diagrams
- [ ] Network errors during save

---

## Phase 7: Documentation & Packaging

### 7.1 Documentation
- [ ] Update README.md with:
  - Installation instructions
  - Usage examples
  - Feature list
  - Screenshots
  - Contribution guidelines
- [ ] Add inline code documentation (docstrings)
- [ ] Create CONTRIBUTING.md
- [ ] Add LICENSE file

### 7.2 Packaging
- [ ] Configure `pyproject.toml` for PyPI distribution
- [ ] Set up entry point: `markdown-os = markdown_os.cli:app`
- [ ] Add version management
- [ ] Create distribution package
- [ ] Test installation via pip

---

## ✅ Finalized Decisions

### 1. Editor Mode: **Tabbed Interface**
- **Decision**: Tabbed mode (switch between Edit/Preview)
- **Rationale**: Easier to implement than WYSIWYG for MVP, provides clean separation of concerns
- **Future**: Migrate to WYSIWYG mode post-MVP for Typora-like experience

### 2. Auto-save Behavior: **Debounced (1 second)**
- **Decision**: Save after 1 second of inactivity (debounced)
- **Rationale**: Balances responsiveness with server load

### 3. Multiple Files: **Single File**
- **Decision**: Single file at a time for MVP
- **Future**: Multiple file tabs in post-MVP

### 4. Browser Auto-open: **Always Open**
- **Decision**: Browser opens automatically on server start
- **Rationale**: Better user experience, no need for manual URL entry

### 5. File Watching: **Yes, with WebSocket**
- **Decision**: Watch for external file changes and notify user via WebSocket
- **Rationale**: Prevents data loss from concurrent edits

### 6. Port Configuration: **Auto-increment**
- **Decision**: Start at port 8000, auto-increment if occupied (8001, 8002...)
- **Rationale**: Better UX, no manual port configuration needed

### 7. Theme: **Light Theme**
- **Decision**: Single light theme for MVP
- **Future**: Add dark theme and theme toggle post-MVP

### 8. Code Block Features:
- **Copy button**: ✅ Included in MVP
- **Language label**: ✅ Included in MVP
- **Line numbers**: ❌ Post-MVP feature

---

## Dependencies Summary

### Python (Backend)
```toml
[project]
name = "markdown-os"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "typer>=0.9.0",
    "python-multipart>=0.0.6",
    "websockets>=12.0",
    "watchdog>=3.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.21.0",
    "httpx>=0.26.0",
]

[project.scripts]
markdown-os = "markdown_os.cli:app"
```

> Note: Using `uv` for package management instead of Poetry

### JavaScript (Frontend - CDN)
- Marked.js: ^11.0.0
- Mermaid.js: ^10.6.0
- svg-pan-zoom: ^3.6.1
- highlight.js: ^11.9.0

---

## Success Metrics (MVP)

- [ ] Can open any `.md` file from CLI with simple `markdown-os open <file>` command
- [ ] Server starts in <2 seconds with auto-port selection
- [ ] Browser opens automatically
- [ ] Tabbed interface switches smoothly between Edit and Preview
- [ ] Markdown renders correctly (GFM support)
- [ ] Mermaid diagrams render and are zoomable
- [ ] Code blocks have syntax highlighting, copy button, and language label
- [ ] TOC generates automatically and updates on scroll
- [ ] Auto-save works within 1 second of last edit
- [ ] External file changes trigger user notification
- [ ] No data loss during normal operation
- [ ] Clean, readable light theme UI

---

## Timeline Estimate (MVP)

- **Phase 1**: Project Setup - 2 hours
- **Phase 2**: Server Setup - 4 hours
- **Phase 3**: HTML Structure - 2 hours
- **Phase 4**: Frontend Logic - 8 hours
- **Phase 5**: Styling - 4 hours
- **Phase 6**: Testing - 4 hours
- **Phase 7**: Documentation - 2 hours

**Total**: ~26 hours for a solid MVP

---

## Next Steps

1. Review and finalize open questions above
2. Set up project structure and dependencies
3. Implement Phase 1 (CLI + basic server)
4. Iterate through phases 2-7
5. Test thoroughly
6. Deploy and gather feedback

---

## Future Enhancements (Post-MVP)

### Developer-Focused Features
- **WYSIWYG mode**: Typora-like single-pane editing experience
- **Dark theme / theme toggle**: Switch between light and dark themes
- **Line numbers for code blocks**: Display line numbers in code blocks
- **Vim keybindings**: Modal editing in the text editor
- **Git integration**: View diff, commit, push from editor
- **Command palette**: Fuzzy search for commands (Ctrl+P)
- **Multi-file support**: Tabs or file tree
- **Live collaboration**: Multiple users editing (WebRTC)
- **LSP integration**: Auto-complete and linting in code blocks
- **Snippet system**: Quick insertion of code/text snippets
- **Markdown templates**: Quick start with templates
- **Export options**: PDF, HTML, DOCX
- **Plugin system**: Custom extensions
- **Custom CSS themes**: User-defined styling
- **Image paste support**: Paste from clipboard
- **Math equations**: KaTeX/MathJax support
- **Task lists**: Interactive checkboxes
- **Presentation mode**: Slides from markdown

---

## Notes

- Keep the MVP focused and simple - resist feature creep
- Prioritize developer experience and performance
- Make it easy to extend post-MVP
- Focus on the 80% use case for developers writing docs/notes
- Ensure clean, maintainable code for open-source contributions
