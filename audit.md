# Markdown-OS Pre-Release Audit

**Date:** 2026-02-23
**Auditor:** Claude Opus 4.6
**Codebase:** 12,055 lines across 25 source files (1,487 Python, 6,397 JS, 2,201 CSS, 459 HTML, 1,511 test)

---

## Executive Summary

**Is this publishable today? No -- but it's close.**

The core architecture is sound. The backend is clean, well-typed, and follows good patterns (atomic writes, file locking, proper path validation). The CLI is polished. The WYSIWYG editor works well for a v0.3 product. However, there are **security vulnerabilities that must be fixed before public release**, significant code duplication in the frontend that will make maintenance painful, and gaps in test coverage for critical paths. The README roadmap lists features that are already implemented (image paste, KaTeX math), which looks sloppy.

The biggest concerns in order:
1. **XSS vectors** in markdown rendering (no HTML sanitization, Mermaid `securityLevel: "loose"`)
2. **Unpinned CDN dependency** (marked.js loaded without version lock)
3. **Platform lock-in** (POSIX `fcntl` locks make this Linux/macOS only with no Windows fallback or clear documentation)
4. **Stale internal files tracked in git** (`.codex/`, `.cursor/`, `landing.html`, `docs/plans/`)
5. **~500+ lines of duplicated frontend code** between `wysiwyg.js` and `markdown.js`

---

## Findings by Severity

---

### RED -- Critical (must fix before public release)

#### 1. No HTML sanitization on markdown rendering

**What:** `marked.parse()` output is injected directly via `innerHTML` in two places:
- `wysiwyg.js:943` -- `state.root.innerHTML = window.marked.parse(markdown || "");`
- `markdown.js:830` -- `preview.innerHTML = window.marked.parse(content ?? "");`

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

#### 2. Mermaid configured with `securityLevel: "loose"`

**What:** Both `wysiwyg.js:463` and `markdown.js:314` initialize Mermaid with `securityLevel: "loose"`, which allows click events and interactive elements in rendered SVG diagrams. Combined with `innerHTML` injection of the SVG output (`wysiwyg.js:1415`, `markdown.js:576`), this enables XSS through crafted Mermaid diagram syntax.

**Why it matters:** Mermaid's loose mode was designed for trusted environments. An open-source markdown editor that opens arbitrary files is not a trusted environment.

**Fix:** Change to `securityLevel: "strict"` in both locations. If interactive diagrams are needed, use `"sandbox"` mode which renders in an iframe.

#### 3. XSS in Mermaid error rendering

**What:** `markdown.js:330` directly interpolates user-authored Mermaid source content into `innerHTML`:
```javascript
container.innerHTML = `<div class="mermaid-error">Invalid mermaid syntax:\n${
  mermaidElement.getAttribute("data-original-content") || mermaidElement.textContent || ""
}</div>`;
```

If the Mermaid source contains `<img src=x onerror=alert(1)>`, it executes.

**Fix:** Use `textContent` instead of `innerHTML`, or escape the content before interpolation.

#### 4. Unpinned marked.js CDN dependency

**What:** `index.html:49` loads marked.js without a version pin:
```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

Every other CDN dependency is version-pinned (turndown@7.2.0, mermaid@10, katex@0.16.21, etc.), but the most security-critical one -- the markdown parser -- is not.

**Why it matters:** jsdelivr serves the latest version by default. A breaking change or compromised release of marked.js would silently affect all users. This also means the editor behavior is non-deterministic across installations.

**Fix:** Pin to a specific version: `https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js` (or whatever the current version is).

#### 5. Unescaped user input in HTML construction

**What:** Several places in `wysiwyg.js` construct HTML strings with unescaped user input:
- Line 1143: `insertHtmlAtSelection(\`<a href="${linkUrl}">${linkUrl}</a>\`)` -- `linkUrl` comes from user prompt
- Line 989: `insertHtmlAtSelection(\`<p><img src="${path}" alt="${alt}" /></p>\`)` -- `path` and `alt` from upload response and user input

A URL containing `" onclick="alert(1)` breaks out of the attribute.

**Fix:** Create a helper function to escape HTML attributes and use it consistently:
```javascript
function escAttr(str) { return str.replace(/["&<>]/g, c => ({'\"':'&quot;','&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
```

#### 6. POSIX-only file locking with no fallback or documentation

**What:** `file_handler.py` imports `fcntl` unconditionally at module level (line 2). This module does not exist on Windows, causing an `ImportError` on import.

**Why it matters:** The README and PyPI page say "Developer-focused markdown editor" with no mention of the platform restriction. Windows users will `pip install markdown-os` and get an immediate crash. This will generate negative first impressions and issues.

**Fix (choose one):**
- **Option A (recommended):** Add a cross-platform locking abstraction. Use `msvcrt` on Windows, `fcntl` on Unix. The `portalocker` package does this.
- **Option B (minimum):** Add `sys_platform != 'win32'` to pyproject.toml classifiers, add a clear "Linux/macOS only" notice to README, and add a runtime check with a helpful error message.

---

### ORANGE -- Important (should fix soon)

#### 7. Internal/editor config files tracked in git

**What:** These files are checked into the repository:
- `.codex/environments/` -- 4 Codex environment config files (references `docs/roadmap.md` which doesn't exist)
- `.cursor/worktrees.json` -- Cursor IDE config (`{"setup-worktree": ["npm install"]}` -- incorrect for a Python project)
- `landing.html` -- Appears to be a superseded version of `site/index.html`
- `docs/plans/` -- Empty plans directory

**Why it matters:** These are personal development environment artifacts. They add noise to the repo, confuse contributors, and make the project look unpolished. The Cursor config is actively misleading (suggests npm).

**Fix:** Add `.codex/`, `.cursor/`, `docs/plans/` to `.gitignore` and remove them from tracking:
```bash
git rm -r --cached .codex .cursor docs/plans landing.html
```

#### 8. README roadmap lists already-implemented features

**What:** The README roadmap section lists:
- "Image paste -- Paste or drag-and-drop images into the editor" -- **Already implemented** (server.py has `/api/images`, wysiwyg.js handles paste/drop)
- "Math equations (KaTeX) -- Inline and display LaTeX math rendering" -- **Already implemented** (KaTeX loaded in index.html, rendering in wysiwyg.js and markdown.js)

**Why it matters:** Makes the project look unmaintained or careless. Users won't know these features exist.

**Fix:** Move implemented features to a "Features" section. Only list genuinely planned work in the roadmap.

#### 9. No CDN Subresource Integrity (SRI) hashes

**What:** All 8 CDN scripts/stylesheets in `index.html` are loaded without `integrity` attributes. If any CDN (jsdelivr, cdnjs) is compromised, malicious code executes in the editor with full access to the local filesystem via the API.

**Why it matters:** The editor has filesystem access. A CDN compromise is a supply chain attack that turns every Markdown-OS user into a victim.

**Fix:** Add SRI hashes to all CDN resources:
```html
<script src="https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js"
        integrity="sha384-..." crossorigin="anonymous"></script>
```

Generate hashes with `openssl dgst -sha384 -binary FILE | openssl base64 -A`.

#### 10. ~500+ lines of duplicated code between wysiwyg.js and markdown.js

**What:** These two files share near-identical implementations of:
- Math extension configuration and rendering (~80 lines)
- Mermaid initialization, rendering, fullscreen, and theme handling (~200 lines)
- Code block decorations (copy button, line numbers, language labels) (~100 lines)
- `configureMarked()` setup (~30 lines)
- `escapeHtmlAttribute()`, `inferLanguageLabel()`, `countCodeLines()`, `createLineNumberGutter()`, `copyToClipboard()` (~80 lines)
- Mermaid theme mapping constant (~10 lines)

**Why it matters:** Any bug fix or feature change needs to be applied in two places. This is how subtle bugs and security inconsistencies creep in. The Mermaid error rendering XSS (finding #3) exists in `markdown.js` but NOT in `wysiwyg.js` -- demonstrating exactly this risk.

**Fix:** Extract shared rendering logic into a `markdown-rendering.js` module that both `wysiwyg.js` and `markdown.js` import from.

#### 11. `focusWithoutScroll` duplicated in 4 files

**What:** The identical `focusWithoutScroll()` helper function is copy-pasted in `wysiwyg.js`, `editor.js`, `tabs.js`, and `dialogs.js`.

**Fix:** Move to a shared `utils.js` module loaded before the dependent scripts.

#### 12. `setSaveStatus` and `setContentLoadingState` duplicated

**What:** `setSaveStatus()` is identical in `editor.js:20` and `tabs.js:13`. `setContentLoadingState()` is identical in `editor.js:75` and `tabs.js:47`. `AUTOSAVE_DELAY_MS` is declared in both files.

**Fix:** Extract to shared module or have one file be the authoritative source.

#### 13. No rate limiting on API endpoints

**What:** The `POST /api/save` and `POST /api/images` endpoints have no rate limiting. While this is a local server, the `--host 0.0.0.0` option exposes it to the network.

**Why it matters:** When exposed on the network, any client can spam save requests or upload images, filling the disk. The image upload is capped at 10MB per file but has no per-session or per-time limit.

**Fix:** Add a simple in-memory rate limiter for the image upload endpoint, or document that `--host 0.0.0.0` is unsafe for untrusted networks.

#### 14. No authentication or access control

**What:** The server has no authentication mechanism. Anyone who can reach the server's port can read files, write files, and upload images. The WebSocket endpoint is also unauthenticated.

**Why it matters:** With `--host 127.0.0.1` (default), this is fine -- only local processes can connect. But with `--host 0.0.0.0`, anyone on the network has full read/write access to the markdown workspace. The CLI help says `--host "Host interface to bind"` with no security warning.

**Fix:** Add a prominent warning when `--host` is set to a non-loopback address:
```python
if host != "127.0.0.1" and host != "localhost":
    typer.secho(
        "WARNING: Binding to non-loopback address exposes your files to the network without authentication.",
        fg=typer.colors.YELLOW,
    )
```

#### 15. `_status_for_read_error` uses string matching

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

#### 16. WebSocketHub broadcast sends sequentially

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

#### 17. No CONTRIBUTING.md or development setup guide

**What:** The README covers installation and usage for end users, but there's no contributor guide. CLAUDE.md contains good development info but is an AI-assistant config file, not contributor documentation.

**Fix:** Create a CONTRIBUTING.md covering: how to set up the dev environment, how to run tests, code style expectations, and PR process. Much of the content can be adapted from CLAUDE.md.

#### 18. `document.execCommand` is deprecated

**What:** `wysiwyg.js` uses `document.execCommand` extensively (lines 220, 958, 1021, 1029, etc.) for text formatting. This API is deprecated and may be removed from browsers.

**Why it matters:** Low urgency -- `execCommand` is still supported in all major browsers and likely will be for years. But it's technical debt.

**Fix:** Long-term, migrate to the [Input Events Level 2](https://www.w3.org/TR/input-events-2/) API or use `Selection`/`Range` APIs directly for formatting operations. No immediate action needed.

#### 19. `navigator.platform` is deprecated

**What:** `wysiwyg-toolbar.js:151` and `search.js:335` use `navigator.platform.toUpperCase().includes("MAC")` for platform detection. This API is deprecated.

**Fix:** Replace with `navigator.userAgentData?.platform` or simply check `navigator.platform` with a graceful fallback (it still works and will for a long time).

#### 20. Mermaid version pinned too broadly

**What:** `index.html:52` pins Mermaid to `@10` (major version only):
```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
```

**Why it matters:** Mermaid 10.x had significant breaking changes between minor versions. A more specific pin (e.g., `@10.9.3`) would prevent unexpected rendering changes.

**Fix:** Pin to a specific minor version.

#### 21. Magic number in TOC scroll offset

**What:** `toc.js:80` uses a hardcoded `100` for heading activation offset:
```javascript
const scrollPosition = container.scrollTop + 100;
```

**Fix:** Extract to a named constant: `const HEADING_ACTIVATION_OFFSET_PX = 100;`

#### 22. Large monolithic `executeCommand` function

**What:** `wysiwyg.js` lines 1013-1211 contains a ~200-line function handling 14 different commands via sequential if-blocks.

**Fix:** Refactor into a command dispatch map:
```javascript
const commands = {
  bold: () => { /* ... */ },
  italic: () => { /* ... */ },
  // ...
};
```

#### 23. `vercel.json` and `site/` directory add confusion

**What:** The repo contains a Vercel deployment config and a `site/` directory with a landing page (~80KB HTML file with screenshots). This is the project website, not part of the editor tool.

**Why it matters:** Contributors may be confused about whether `site/` is part of the package. The Hatch build config correctly scopes to `markdown_os/`, so it won't be included in the wheel, but it still clutters the repo.

**Fix:** Consider moving the website to a separate `gh-pages` branch or a `docs/` directory. At minimum, add a comment in the README noting that `site/` is the project website, not part of the package.

#### 24. `example.md` tracked but also gitignored

**What:** `.gitignore` has `/example.md` to ignore generated examples, but `example.md` is tracked in git (it's the demo file at the project root).

**Why it matters:** Minor confusion. The gitignore rule uses a leading `/` which only matches the root, so it's technically correct. But having a tracked file match a gitignore pattern is unusual.

**Fix:** Either rename the tracked example to something more specific (like `demo.md`) or remove it from tracking if it's meant to be generated.

#### 25. No `py.typed` marker file

**What:** The project declares `Typing :: Typed` in its classifiers but doesn't include a `py.typed` marker file in the package. PEP 561 requires this for type checkers to recognize the package as typed.

**Fix:** Create an empty `markdown_os/py.typed` file and ensure it's included in the wheel.

---

## Testing Assessment

### Current State

| Test File | Tests | Coverage Quality |
|---|---|---|
| `test_cli.py` | 14 | Good -- CLI paths well covered |
| `test_server.py` | 16 | Moderate -- happy paths good, error paths weak |
| `test_file_handler.py` | 7 | Moderate -- basic read/write, missing error paths |
| `test_directory_handler.py` | 5 | Weak -- minimal edge case coverage |
| `test_frontend_navigation_sync.py` | 18 | Misleading -- static string matching, not behavioral |
| `test_version.py` | 1 | Fine for its scope |

### Critical Coverage Gaps

1. **WebSocket/Watchdog pipeline (0% coverage):** The entire real-time sync flow (`MarkdownPathEventHandler` -> `_broadcast_external_change` -> `WebSocketHub`) has zero tests. This is the most complex concurrent code in the project.

2. **Error paths in server routes:** `FileWriteError` during save, `FileReadError` during metadata, concurrent access failures -- none tested.

3. **Concurrent file locking:** The `fcntl` locking in `FileHandler` exists specifically for concurrency safety but is never tested under concurrent conditions.

4. **Frontend behavioral testing:** The 6,397 lines of JavaScript have no functional tests. The "frontend tests" are static string searches against source code.

5. **Security edge cases:** Only basic `../` traversal is tested. Missing: URL-encoded traversal, null bytes, symlink following, oversized paths, concurrent save conflicts.

### High-Leverage Test Suggestions

1. **WebSocketHub unit tests:** Test connect/disconnect/broadcast with mock WebSockets. Test stale client cleanup. ~30 minutes of work, high value.

2. **MarkdownPathEventHandler tests:** Test throttling (events within 200ms), self-write ignore (events within 500ms of internal write), path relevance filtering. ~45 minutes.

3. **Server error path tests:** Mock `FileHandler.write()` to raise `FileWriteError` and verify 500 response. Mock `FileHandler.read()` to raise and verify proper status codes. ~20 minutes.

4. **Directory traversal fuzzing:** Test `GET /api/content?file=` and `POST /api/save` with payloads like `foo/../../etc/passwd`, `%2e%2e/`, null bytes, backslash paths, extremely long paths. ~30 minutes.

5. **Concurrent write test:** Two threads writing to the same file through `FileHandler` simultaneously. Verify no data corruption or partial writes. ~30 minutes.

---

## Architecture Assessment

### Strengths

- **Clean separation between CLI, server, and file I/O layers.** Each has a clear responsibility and the boundaries are well-defined.
- **Atomic file writes with proper fsync.** The temp-file-then-replace pattern in `FileHandler` is the correct way to do safe writes.
- **Path traversal protection.** `DirectoryHandler._resolve_relative_markdown_path()` properly validates that paths stay within the workspace using `.is_relative_to()`.
- **WebSocket design.** The hub pattern with async locking is appropriate for the scale.
- **File tree caching.** `DirectoryHandler` caches `FileHandler` instances per file, avoiding repeated initialization.
- **Mode-aware architecture.** The file/folder mode distinction flows cleanly from CLI through server to handlers.

### Concerns

- **Frontend architecture will not scale.** The IIFE-per-file pattern with `window.MarkdownOS` namespacing works now but makes dependency management implicit. Module bundling (even a simple concatenation build step) would help.
- **No abstraction between rendering modes.** `wysiwyg.js` and `markdown.js` are two parallel implementations of the same rendering pipeline. This is the biggest architectural debt.
- **Watchdog threading model.** The `loop.call_soon_threadsafe` -> `asyncio.create_task` bridge between watchdog threads and the async event loop is correct but not tested. A bug here would be subtle and hard to reproduce.

---

## DX (Developer Experience) Assessment

### Setup: Good

- `uv sync` is a single command to install everything
- `uv run markdown-os open ./file.md` works immediately
- `uv run pytest` runs all tests
- No build step for frontend (vanilla JS)
- Python 3.11+ requirement is reasonable

### Contributor Experience: Needs Work

- No CONTRIBUTING.md
- CLAUDE.md has the best development documentation but isn't discoverable for human contributors
- `.codex/` and `.cursor/` configs suggest tool-specific workflows that others won't share
- No linting/formatting configuration (no ruff, black, or eslint config)
- No pre-commit hooks
- No type checking in CI (no mypy or pyright)

### Pain Points

- **Windows users will hit an `ImportError` immediately** with no helpful error message (finding #6)
- The `--host 0.0.0.0` option silently exposes files to the network (finding #14)
- Lock files (`.md.lock`) are left behind on crash (cleanup only runs on graceful shutdown)
- The roadmap listing implemented features is confusing for new users (finding #8)

---

## Summary Action Plan

### Before making public (1-2 days):
1. Add DOMPurify sanitization layer (finding #1)
2. Change Mermaid to `securityLevel: "strict"` (finding #2)
3. Fix Mermaid error XSS (finding #3)
4. Pin marked.js version (finding #4)
5. Escape HTML attributes in user-provided content (finding #5)
6. Remove `.codex/`, `.cursor/`, `landing.html` from git tracking (finding #7)
7. Update README roadmap (finding #8)
8. Add Windows incompatibility notice or fix (finding #6)
9. Add warning for non-loopback `--host` (finding #14)

### Soon after public (1-2 weeks):
10. Add SRI hashes to CDN resources (finding #9)
11. Extract shared rendering code (finding #10)
12. Extract duplicated utility functions (findings #11, #12)
13. Add WebSocket and watchdog tests (testing gaps)
14. Add CONTRIBUTING.md (finding #17)
15. Fix string-based error classification (finding #15)
16. Add parallel WebSocket broadcast (finding #16)

### When convenient:
17. Pin Mermaid to specific minor version (finding #20)
18. Add `py.typed` marker (finding #25)
19. Consider moving site/ to gh-pages branch (finding #23)
20. Add linting/formatting to CI
21. Add `mypy` type checking to CI
