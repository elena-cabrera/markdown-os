# Markdown-OS Pre-Release Audit

**Date:** 2026-02-23  
**Auditor:** Claude Opus 4.6  
**Codebase:** 12,055 lines across 25 source files (1,487 Python, 6,397 JS, 2,201 CSS, 459 HTML, 1,511 test)

---

## Executive Summary

**Is this publishable today? No -- but it's close.**

The core architecture is sound. The backend is clean, well-typed, and follows good patterns (atomic writes, file locking, proper path validation). The CLI is polished. The WYSIWYG editor works well for a v0.3 product. However, there are **security vulnerabilities that must be fixed before public release**, significant code duplication in the frontend that will make maintenance painful, and gaps in test coverage for critical paths.

The biggest concerns in order:

1.  **XSS vectors** in markdown rendering (no HTML sanitization)
2.  **~500+ lines of duplicated frontend code** between `wysiwyg.js` and `markdown.js`

---

## Findings by Severity

---

### RED -- Critical (must fix before public release)

#### 1\. No HTML sanitization on markdown rendering

**What:** `marked.parse()` output is injected directly via `innerHTML` in two places:

-   `wysiwyg.js:943` -- `state.root.innerHTML = window.marked.parse(markdown || "");`
-   `markdown.js:830` -- `preview.innerHTML = window.marked.parse(content ?? "");`

Marked.js with GFM mode allows raw HTML passthrough by default. A markdown file containing `<img src=x onerror=alert(document.cookie)>` or `<script>` tags will execute JavaScript in the editor.

**Why it matters:** This is a local editor, so the threat model is "user opens a malicious markdown file." For an open-source tool, people will open files from untrusted sources (downloaded repos, shared documents, AI-generated markdown). The XSS executes with full access to the local server, including the ability to read/write any file the server has access to via the API.

**Fix:** Add [DOMPurify](https://github.com/cure53/DOMPurify) as a sanitization layer after `marked.parse()`. Either bundle it as a local dependency or load from CDN with SRI hash. Configure it to allow safe elements while stripping `<script>`, event handlers, and `javascript:` URIs.

```javascript
// After marked.parse():
const rawHtml = window.marked.parse(markdown || "");
const cleanHtml = DOMPurify.sanitize(rawHtml, {
  ADD_TAGS: ['svg', 'path', 'circle', 'line', 'polyline', 'g'],
  ADD_ATTR: ['viewBox', 'fill', 'stroke', 'd', 'points', 'cx', 'cy', 'r'],
});
state.root.innerHTML = cleanHtml;

```

---

### ORANGE -- Important (should fix soon)

#### 2\. No CDN Subresource Integrity (SRI) hashes

**What:** All 8 CDN scripts/stylesheets in `index.html` are loaded without `integrity` attributes. If any CDN (jsdelivr, cdnjs) is compromised, malicious code executes in the editor with full access to the local filesystem via the API.

**Why it matters:** The editor has filesystem access. A CDN compromise is a supply chain attack that turns every Markdown-OS user into a victim.

**Fix:** Add SRI hashes to all CDN resources:

```html
<script src="https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js"
        integrity="sha384-..." crossorigin="anonymous"></script>

```

Generate hashes with `openssl dgst -sha384 -binary FILE | openssl base64 -A`.

#### 3\. ~500+ lines of duplicated code between wysiwyg.js and markdown.js

**What:** These two files share near-identical implementations of:

-   Math extension configuration and rendering (~80 lines)
-   Mermaid initialization, rendering, fullscreen, and theme handling (~200 lines)
-   Code block decorations (copy button, line numbers, language labels) (~100 lines)
-   `configureMarked()` setup (~30 lines)
-   `escapeHtmlAttribute()`, `inferLanguageLabel()`, `countCodeLines()`, `createLineNumberGutter()`, `copyToClipboard()` (~80 lines)
-   Mermaid theme mapping constant (~10 lines)

**Why it matters:** Any bug fix or feature change needs to be applied in two places. This is how subtle bugs and security inconsistencies creep in.

**Fix:** Extract shared rendering logic into a `markdown-rendering.js` module that both `wysiwyg.js` and `markdown.js` import from.

#### 4\. `focusWithoutScroll` duplicated in 4 files

**What:** The identical `focusWithoutScroll()` helper function is copy-pasted in `wysiwyg.js`, `editor.js`, `tabs.js`, and `dialogs.js`.

**Fix:** Move to a shared `utils.js` module loaded before the dependent scripts.

#### 5\. `setSaveStatus` and `setContentLoadingState` duplicated

**What:** `setSaveStatus()` is identical in `editor.js:20` and `tabs.js:13`. `setContentLoadingState()` is identical in `editor.js:75` and `tabs.js:47`. `AUTOSAVE_DELAY_MS` is declared in both files.

**Fix:** Extract to shared module or have one file be the authoritative source.

#### 6\. No rate limiting on API endpoints

**What:** The `POST /api/save` and `POST /api/images` endpoints have no rate limiting. While this is a local server, the `--host 0.0.0.0` option exposes it to the network.

**Why it matters:** When exposed on the network, any client can spam save requests or upload images, filling the disk. The image upload is capped at 10MB per file but has no per-session or per-time limit.

**Fix:** Add a simple in-memory rate limiter for the image upload endpoint, or document that `--host 0.0.0.0` is unsafe for untrusted networks.

#### 7\. `_status_for_read_error` uses string matching

**What:** `server.py:699` determines HTTP status codes by checking if `"does not exist"` appears in the error message string:

```python
def _status_for_read_error(error: FileReadError) -> int:
    if "does not exist" in str(error):
        return 404
    return 500

```

**Why it matters:** This is fragile. If the error message wording changes in `file_handler.py`, the 404 response silently becomes a 500. String-based error classification is an anti-pattern.

**Fix:** Use exception subclasses or error codes:

```python
class FileNotFoundError(FileReadError):
    pass

class FileIOError(FileReadError):
    pass

```

#### 8\. WebSocketHub broadcast sends sequentially

**What:** `server.py:94-98` sends to each client sequentially in a loop. If one client has a slow connection, all subsequent clients wait.

```python
for client in clients:
    try:
        await client.send_json(payload)
    except RuntimeError:
        stale_clients.append(client)

```

**Fix:** Use `asyncio.gather()` with `return_exceptions=True` for parallel broadcast:

```python
results = await asyncio.gather(
    *(client.send_json(payload) for client in clients),
    return_exceptions=True
)

```

---

### YELLOW -- Nice to have

#### 9\. No CONTRIBUTING.md or development setup guide

**What:** The README covers installation and usage for end users, but there's no contributor guide. CLAUDE.md contains good development info but is an AI-assistant config file, not contributor documentation.

**Fix:** Create a CONTRIBUTING.md covering: how to set up the dev environment, how to run tests, code style expectations, and PR process. Much of the content can be adapted from CLAUDE.md.

#### 10\. `document.execCommand` is deprecated

**What:** `wysiwyg.js` uses `document.execCommand` extensively (lines 220, 958, 1021, 1029, etc.) for text formatting. This API is deprecated and may be removed from browsers.

**Why it matters:** Low urgency -- `execCommand` is still supported in all major browsers and likely will be for years. But it's technical debt.

**Fix:** Long-term, migrate to the [Input Events Level 2](https://www.w3.org/TR/input-events-2/) API or use `Selection`/`Range` APIs directly for formatting operations. No immediate action needed.

#### 11\. `navigator.platform` is deprecated

**What:** `wysiwyg-toolbar.js:151` and `search.js:335` use `navigator.platform.toUpperCase().includes("MAC")` for platform detection. This API is deprecated.

**Fix:** Replace with `navigator.userAgentData?.platform` or simply check `navigator.platform` with a graceful fallback (it still works and will for a long time).

#### 12\. Mermaid version pinned too broadly

**What:** `index.html:52` pins Mermaid to `@10` (major version only):

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

```

**Why it matters:** Mermaid 10.x had significant breaking changes between minor versions. A more specific pin (e.g., `@10.9.3`) would prevent unexpected rendering changes.

**Fix:** Pin to a specific minor version.

#### 13\. Magic number in TOC scroll offset

**What:** `toc.js:80` uses a hardcoded `100` for heading activation offset:

```javascript
const scrollPosition = container.scrollTop + 100;

```

**Fix:** Extract to a named constant: `const HEADING_ACTIVATION_OFFSET_PX = 100;`

#### 14\. Large monolithic `executeCommand` function

**What:** `wysiwyg.js` lines 1013-1211 contains a ~200-line function handling 14 different commands via sequential if-blocks.

**Fix:** Refactor into a command dispatch map:

```javascript
const commands = {
  bold: () => { /* ... */ },
  italic: () => { /* ... */ },
  // ...
};

```

#### 15\. `vercel.json` and `site/` directory add confusion

**What:** The repo contains a Vercel deployment config and a `site/` directory with a landing page (~80KB HTML file with screenshots). This is the project website, not part of the editor tool.

**Why it matters:** Contributors may be confused about whether `site/` is part of the package. The Hatch build config correctly scopes to `markdown_os/`, so it won't be included in the wheel, but it still clutters the repo.

**Fix:** Consider moving the website to a separate `gh-pages` branch or a `docs/` directory. At minimum, add a comment in the README noting that `site/` is the project website, not part of the package.

#### 16\. `example.md` tracked but also gitignored

**What:** `.gitignore` has `/example.md` to ignore generated examples, but `example.md` is tracked in git (it's the demo file at the project root).

**Why it matters:** Minor confusion. The gitignore rule uses a leading `/` which only matches the root, so it's technically correct. But having a tracked file match a gitignore pattern is unusual.

**Fix:** Either rename the tracked example to something more specific (like `demo.md`) or remove it from tracking if it's meant to be generated.

#### 17\. No `py.typed` marker file

**What:** The project declares `Typing :: Typed` in its classifiers but doesn't include a `py.typed` marker file in the package. PEP 561 requires this for type checkers to recognize the package as typed.

**Fix:** Create an empty `markdown_os/py.typed` file and ensure it's included in the wheel.

---

## Testing Assessment

### Current State

| Test File | Tests | Coverage Quality |
| --- | --- | --- |
| `test_cli.py` | 14 | Good -- CLI paths well covered |
| `test_server.py` | 16 | Moderate -- happy paths good, error paths weak |
| `test_file_handler.py` | 7 | Moderate -- basic read/write, missing error paths |
| `test_directory_handler.py` | 5 | Weak -- minimal edge case coverage |
| `test_frontend_navigation_sync.py` | 18 | Misleading -- static string matching, not behavioral |
| `test_version.py` | 1 | Fine for its scope |

### Critical Coverage Gaps

1.  **WebSocket/Watchdog pipeline (0% coverage):** The entire real-time sync flow (`MarkdownPathEventHandler` -> `_broadcast_external_change` -> `WebSocketHub`) has zero tests. This is the most complex concurrent code in the project.
    
2.  **Error paths in server routes:** `FileWriteError` during save, `FileReadError` during metadata, concurrent access failures -- none tested.
    
3.  **Concurrent file locking:** The `fcntl` locking in `FileHandler` exists specifically for concurrency safety but is never tested under concurrent conditions.
    
4.  **Frontend behavioral testing:** The 6,397 lines of JavaScript have no functional tests. The "frontend tests" are static string searches against source code.
    
5.  **Security edge cases:** Only basic `../` traversal is tested. Missing: URL-encoded traversal, null bytes, symlink following, oversized paths, concurrent save conflicts.
    

### High-Leverage Test Suggestions

1.  **WebSocketHub unit tests:** Test connect/disconnect/broadcast with mock WebSockets. Test stale client cleanup. ~30 minutes of work, high value.
    
2.  **MarkdownPathEventHandler tests:** Test throttling (events within 200ms), self-write ignore (events within 500ms of internal write), path relevance filtering. ~45 minutes.
    
3.  **Server error path tests:** Mock `FileHandler.write()` to raise `FileWriteError` and verify 500 response. Mock `FileHandler.read()` to raise and verify proper status codes. ~20 minutes.
    
4.  **Directory traversal fuzzing:** Test `GET /api/content?file=` and `POST /api/save` with payloads like `foo/../../etc/passwd`, `%2e%2e/`, null bytes, backslash paths, extremely long paths. ~30 minutes.
    
5.  **Concurrent write test:** Two threads writing to the same file through `FileHandler` simultaneously. Verify no data corruption or partial writes. ~30 minutes.
    

---

## Architecture Assessment

### Strengths

-   **Clean separation between CLI, server, and file I/O layers.** Each has a clear responsibility and the boundaries are well-defined.
-   **Atomic file writes with proper fsync.** The temp-file-then-replace pattern in `FileHandler` is the correct way to do safe writes.
-   **Path traversal protection.** `DirectoryHandler._resolve_relative_markdown_path()` properly validates that paths stay within the workspace using `.is_relative_to()`.
-   **WebSocket design.** The hub pattern with async locking is appropriate for the scale.
-   **File tree caching.** `DirectoryHandler` caches `FileHandler` instances per file, avoiding repeated initialization.
-   **Mode-aware architecture.** The file/folder mode distinction flows cleanly from CLI through server to handlers.

### Concerns

-   **Frontend architecture will not scale.** The IIFE-per-file pattern with `window.MarkdownOS` namespacing works now but makes dependency management implicit. Module bundling (even a simple concatenation build step) would help.
-   **No abstraction between rendering modes.** `wysiwyg.js` and `markdown.js` are two parallel implementations of the same rendering pipeline. This is the biggest architectural debt.
-   **Watchdog threading model.** The `loop.call_soon_threadsafe` -> `asyncio.create_task` bridge between watchdog threads and the async event loop is correct but not tested. A bug here would be subtle and hard to reproduce.

---

## DX (Developer Experience) Assessment

### Setup: Good

-   `uv sync` is a single command to install everything
-   `uv run markdown-os open ./file.md` works immediately
-   `uv run pytest` runs all tests
-   No build step for frontend (vanilla JS)
-   Python 3.11+ requirement is reasonable

### Contributor Experience: Needs Work

-   No CONTRIBUTING.md
-   CLAUDE.md has the best development documentation but isn't discoverable for human contributors
-   No linting/formatting configuration (no ruff, black, or eslint config)
-   No pre-commit hooks
-   No type checking in CI (no mypy or pyright)

### Pain Points

-   Lock files (`.md.lock`) are left behind on crash (cleanup only runs on graceful shutdown)

---

## Summary Action Plan

### Before making public:

1.  Add DOMPurify sanitization layer (finding #1)

### Soon after public (1-2 weeks):

2.  Add SRI hashes to CDN resources (finding #2)
3.  Extract shared rendering code (finding #3)
4.  Extract duplicated utility functions (findings #4, #5)
5.  Add WebSocket and watchdog tests (testing gaps)
6.  Add CONTRIBUTING.md (finding #9)
7.  Fix string-based error classification (finding #7)
8.  Add parallel WebSocket broadcast (finding #8)

### When convenient:

9.  Pin Mermaid to specific minor version (finding #12)
10.  Add `py.typed` marker (finding #17)
11.  Consider moving site/ to gh-pages branch (finding #15)
12.  Add linting/formatting to CI
13.  Add `mypy` type checking to CI