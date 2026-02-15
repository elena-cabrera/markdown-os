# Feature Plan: PyPI Package Publishing

**Status:** Draft
**Created:** 2026-02-15
**Author:** Claude (via feature-planner skill)

---

## Overview

Publish markdown-os to PyPI so users can install with `pip install markdown-os` or `uv pip install markdown-os` instead of cloning the repository. Includes project metadata enrichment, a LICENSE file, a `__version__` attribute via `importlib.metadata`, and a GitHub Actions CI/CD workflow for automated publishing on tagged releases.

**Key Features:**
- Complete PyPI metadata (author, URLs, classifiers, keywords)
- Apache 2.0 LICENSE file
- Programmatic `__version__` via `importlib.metadata` (single source of truth in `pyproject.toml`)
- GitHub Actions workflow: auto-publish to PyPI on version tags (`v*`)
- Verified static asset inclusion in built distributions
- Updated README with PyPI installation instructions

**Includes:**
- `pyproject.toml` metadata enhancements
- `LICENSE` file (Apache 2.0)
- `__init__.py` version exposure
- `.github/workflows/publish.yml` CI/CD pipeline
- README update with install instructions and PyPI badge

---

## User Story / Value Proposition

**Problem:**
Currently, users must clone the repository and run `uv sync` to use markdown-os. This requires familiarity with `uv`, Git, and Python project tooling. There's no way to install it as a standalone CLI tool, which limits adoption and discoverability.

**Solution:**
Publish to PyPI with proper metadata, making the tool installable via standard Python package managers. Add CI/CD to automate the release process so new versions are published by simply pushing a Git tag.

**User Benefit:**
- **Trivial installation** — `pip install markdown-os` or `uv tool install markdown-os`
- **Discoverability** — appears in PyPI search results
- **Automatic updates** — `pip install --upgrade markdown-os`
- **No repo cloning** — users don't need Git or knowledge of project internals
- **Isolated installs** — `uv tool install` or `pipx install` for system-wide CLI access

**Use Cases:**
1. **New user** — finds markdown-os on PyPI, installs with pip, runs `markdown-os open notes.md`
2. **CI environment** — installs as a pip dependency for documentation tooling
3. **Developer** — uses `uv tool install markdown-os` for global CLI access without venv management
4. **Maintainer** — pushes `v0.2.0` tag, GitHub Actions publishes to PyPI automatically

---

## Current Behavior

### Project Configuration (`pyproject.toml`)
The project already uses Hatchling as its build backend and has:
- ✅ `name`, `version`, `description`, `readme`, `requires-python`, `dependencies`
- ✅ `[project.scripts]` entry point: `markdown-os = "markdown_os.cli:run"`
- ✅ `[tool.hatch.build.targets.wheel]` with `packages` and `force-include`
- ❌ No `license`, `authors`, `keywords`, `classifiers`, or `urls`

### Package Structure
```
markdown_os/
├── __init__.py          # exports app, no __version__
├── cli.py               # Typer CLI with open/example commands
├── file_handler.py      # File I/O with locking
├── server.py            # FastAPI application
├── static/              # Frontend assets (HTML, CSS, JS)
│   ├── index.html
│   ├── css/styles.css
│   └── js/*.js
└── templates/
    └── example_template.md
```

### Missing for PyPI
- No `LICENSE` file
- No author/URL metadata
- No `__version__` attribute
- No CI/CD workflow
- No `.github/` directory at all
- README doesn't mention pip installation

---

## Proposed Behavior

After implementation:

1. `pip install markdown-os` installs the package globally or in a virtualenv
2. `markdown-os open notes.md` works immediately after install
3. `python -c "import markdown_os; print(markdown_os.__version__)"` prints the version
4. Pushing a tag like `v0.2.0` triggers GitHub Actions to build and publish to PyPI
5. The PyPI page shows a rich project description with links, classifiers, and license info

---

## Implementation Plan

### 1. Add LICENSE File

**File**: `LICENSE` (new, project root)

**Changes**:
- Create Apache License 2.0 file with correct copyright year and holder

**Rationale**: Required for PyPI publishing. Apache 2.0 chosen per user preference — provides patent protection while remaining permissive.

---

### 2. Enrich `pyproject.toml` Metadata

**File**: `pyproject.toml`

**Changes**:
- Add `license` field
- Add `authors` field
- Add `keywords` for PyPI search discoverability
- Add `classifiers` for PyPI categorization
- Add `[project.urls]` for project links
- Verify `readme` points to `README.md`

**Example additions**:
```toml
[project]
name = "markdown-os"
version = "0.1.0"
description = "Developer-focused markdown editor served from a local CLI."
readme = "README.md"
license = "Apache-2.0"
requires-python = ">=3.11"
authors = [
    { name = "Elena" },
]
keywords = ["markdown", "editor", "cli", "preview", "developer-tools"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Environment :: Console",
    "Environment :: Web Environment",
    "Framework :: FastAPI",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: Apache Software License",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Programming Language :: Python :: 3.13",
    "Topic :: Text Editors",
    "Topic :: Text Processing :: Markup :: Markdown",
    "Typing :: Typed",
]

[project.urls]
Homepage = "https://github.com/<owner>/markdown-os"
Repository = "https://github.com/<owner>/markdown-os"
Issues = "https://github.com/<owner>/markdown-os/issues"
```

**Decision**: The `<owner>` placeholder must be replaced with the actual GitHub username or org.

---

### 3. Add `__version__` via `importlib.metadata`

**File**: `markdown_os/__init__.py`

**Changes**:
- Read version from installed package metadata (single source of truth)
- Fall back gracefully for editable/development installs

**Updated code**:
```python
"""Markdown-OS package."""

from importlib.metadata import PackageNotFoundError, version

from markdown_os.cli import app

try:
    __version__ = version("markdown-os")
except PackageNotFoundError:
    __version__ = "0.0.0-dev"

__all__ = ["__version__", "app"]
```

**Rationale**: `importlib.metadata.version()` reads the version from the installed package metadata, which is populated from `pyproject.toml` at build time. This avoids version duplication. The fallback handles the case where the package is run from source without being installed.

---

### 4. Verify Static Assets Are Included in Build

**File**: `pyproject.toml` (verify existing config)

**Changes**:
- Verify that `markdown_os/static/` is included in wheel builds
- Verify that `markdown_os/templates/` is included (already force-included)

**Verification steps**:
```bash
# Build the package
uv build

# Inspect the wheel contents
unzip -l dist/markdown_os-*.whl | grep -E "(static|templates)"
```

The current Hatch config includes:
```toml
[tool.hatch.build.targets.wheel]
packages = ["markdown_os"]

[tool.hatch.build.targets.wheel.force-include]
"markdown_os/templates" = "markdown_os/templates"
```

Since `packages = ["markdown_os"]` includes the entire `markdown_os/` directory, the `static/` subdirectory should be included automatically. The `force-include` for `templates/` is redundant but harmless. This step verifies both are present in the built artifact.

---

### 5. Create GitHub Actions Publish Workflow

**File**: `.github/workflows/publish.yml` (new)

**Changes**:
- Workflow triggers on push of version tags (`v*`)
- Builds sdist and wheel with `uv build`
- Runs tests before publishing
- Publishes to PyPI using PyPI's trusted publisher (OIDC) — no API token secrets needed

**Workflow**:
```yaml
name: Publish to PyPI

on:
  push:
    tags:
      - "v*"

permissions:
  id-token: write  # Required for trusted publishing

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv sync --dev
      - run: uv run pytest

  publish:
    needs: test
    runs-on: ubuntu-latest
    environment: pypi
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv build
      - uses: pypa/gh-action-pypi-publish@release/v1
```

**Rationale**: Trusted publishing (OIDC) is the recommended approach — no need to store PyPI API tokens as GitHub secrets. Requires one-time setup on PyPI to link the GitHub repository as a trusted publisher.

**Prerequisites** (manual, one-time):
1. Create a PyPI account at https://pypi.org
2. Create the `markdown-os` project on PyPI (or claim the name via first upload)
3. Add a "trusted publisher" under the project settings on PyPI:
   - Repository owner: `<owner>`
   - Repository name: `markdown-os`
   - Workflow name: `publish.yml`
   - Environment: `pypi`
4. Create a GitHub environment named `pypi` in the repo settings (Settings → Environments)

---

### 6. Update README with Installation Instructions

**File**: `README.md`

**Changes**:
- Add a "Quick Install" section at the top (after the header)
- Add a PyPI badge
- Keep existing `uv sync` instructions for development

**New section** (inserted after `# Markdown-OS` header):

```markdown
[![PyPI version](https://img.shields.io/pypi/v/markdown-os)](https://pypi.org/project/markdown-os/)

## Quick Install

```bash
# Install from PyPI
pip install markdown-os

# Or with uv
uv tool install markdown-os
```

Then run:
```bash
markdown-os open ./notes.md
```
```

---

### 7. Release Process Documentation

No separate file needed — the release process is simple enough to document here.

**To release a new version:**

```bash
# 1. Update version in pyproject.toml
#    version = "0.2.0"

# 2. Commit the version bump
git add pyproject.toml
git commit -m "chore: bump version to 0.2.0"

# 3. Tag and push
git tag v0.2.0
git push origin master --tags
```

GitHub Actions will then:
1. Run the test suite
2. Build sdist + wheel
3. Publish to PyPI via trusted publishing

---

## Decisions / Open Questions

### Q1: GitHub Username/Org for URLs ❓
**Decision**: The `pyproject.toml` URLs and the trusted publisher config need the actual GitHub username or organization. Replace `<owner>` placeholders during implementation.

### Q2: PyPI Project Name Availability ✅
**Decision**: The name `markdown-os` needs to be checked for availability on PyPI before publishing. If taken, alternatives like `markdownos` or `md-os` could work — but `markdown-os` matches the repo name and CLI command.

### Q3: License Approach ✅
**Decision**: Apache 2.0 selected by user. Provides patent grant protection while remaining permissive and compatible with most other open source licenses.

### Q4: Version Strategy ✅
**Decision**: Single source of truth in `pyproject.toml`, exposed via `importlib.metadata` in `__init__.py`. No version duplication.

### Q5: CI/CD Approach ✅
**Decision**: GitHub Actions with trusted publishing (OIDC). No API token management required. Triggers on version tags.

---

## Edge Cases

#### Case 1: Package Name Already Taken on PyPI
- **Scenario**: Someone has already registered `markdown-os` on PyPI
- **Expected behavior**: Discover this during first upload attempt
- **Implementation note**: Check availability with `pip index versions markdown-os` or by visiting https://pypi.org/project/markdown-os/ before implementation. If taken, choose an alternative name and update `pyproject.toml` and README accordingly.

#### Case 2: Static Assets Missing from Wheel
- **Scenario**: Built wheel doesn't include `static/` or `templates/` directories
- **Expected behavior**: Build verification step catches this before publishing
- **Implementation note**: Inspect wheel contents with `unzip -l dist/*.whl`. If assets are missing, add explicit `force-include` entries in `pyproject.toml` for the static directory.

#### Case 3: Trusted Publisher Not Configured
- **Scenario**: Tag is pushed before PyPI trusted publisher is set up
- **Expected behavior**: Publish step fails with clear OIDC error
- **Implementation note**: The `publish` job requires the `pypi` environment, so it will fail safely. Document the one-time setup steps clearly.

#### Case 4: Version Tag Without pyproject.toml Update
- **Scenario**: Developer pushes `v0.3.0` tag but forgot to update `version` in `pyproject.toml`
- **Expected behavior**: Package publishes with the old version number (mismatch between tag and package version)
- **Implementation note**: Consider adding a CI step that validates the tag matches the version in `pyproject.toml`. Example: `python -c "import tomllib; v=tomllib.load(open('pyproject.toml','rb'))['project']['version']; tag='${GITHUB_REF_NAME}'.lstrip('v'); assert v==tag, f'{v} != {tag}'"`.

#### Case 5: Development Install (`uv sync` / editable install)
- **Scenario**: Developer runs from source without `pip install`
- **Expected behavior**: `__version__` falls back to `"0.0.0-dev"`
- **Implementation note**: The `PackageNotFoundError` catch in `__init__.py` handles this. With `uv sync`, the package metadata is available so version should resolve correctly.

---

## Testing Strategy

### Manual Tests

1. **Build locally** → `uv build` produces both `.tar.gz` and `.whl` in `dist/`
2. **Inspect wheel** → `unzip -l dist/*.whl` shows `static/`, `templates/`, and all Python modules
3. **Install from wheel** → `pip install dist/markdown_os-*.whl` installs successfully
4. **CLI works after install** → `markdown-os open test.md` launches the editor
5. **Version accessible** → `python -c "import markdown_os; print(markdown_os.__version__)"` prints `0.1.0`
6. **Example command works** → `markdown-os example --open` generates and opens showcase file
7. **TestPyPI dry run** → Upload to TestPyPI first, install from there, verify everything works
8. **Tag-triggered publish** → Push a tag, verify GitHub Actions runs and publishes successfully

### Automated Tests

Add a minimal test for version exposure:

```python
# tests/test_version.py
def test_version_is_accessible():
    import markdown_os
    assert hasattr(markdown_os, "__version__")
    assert isinstance(markdown_os.__version__, str)
    assert markdown_os.__version__ != ""
```

Existing tests (`uv run pytest`) must continue passing — no behavioral changes to the application.

---

## Files to Modify

| File | Changes |
|------|---------|
| `LICENSE` | **New** — Apache 2.0 license text |
| `pyproject.toml` | Add `license`, `authors`, `keywords`, `classifiers`, `[project.urls]` |
| `markdown_os/__init__.py` | Add `__version__` via `importlib.metadata` |
| `.github/workflows/publish.yml` | **New** — CI/CD workflow for tag-triggered PyPI publishing |
| `README.md` | Add PyPI badge, "Quick Install" section with pip/uv instructions |
| `tests/test_version.py` | **New** — Test for `__version__` attribute |

---

## Implementation Checklist

### Phase 1: Package Metadata & License
- [ ] Create `LICENSE` file (Apache 2.0)
- [ ] Add `license`, `authors`, `keywords`, `classifiers` to `pyproject.toml`
- [ ] Add `[project.urls]` to `pyproject.toml` (requires GitHub username)
- [ ] Add `__version__` to `markdown_os/__init__.py` via `importlib.metadata`
- [ ] Add version test in `tests/test_version.py`
- [ ] Run existing tests — verify no regressions

### Phase 2: Build Verification
- [ ] Run `uv build` and verify sdist and wheel are created
- [ ] Inspect wheel contents — verify `static/` and `templates/` are included
- [ ] Install from built wheel in a clean venv — verify CLI works
- [ ] Verify `__version__` resolves correctly after install

### Phase 3: CI/CD Setup
- [ ] Create `.github/workflows/publish.yml`
- [ ] Create PyPI account (if needed)
- [ ] Check `markdown-os` name availability on PyPI
- [ ] Register trusted publisher on PyPI (link GitHub repo)
- [ ] Create `pypi` environment in GitHub repo settings

### Phase 4: First Release
- [ ] Update README with install instructions and PyPI badge
- [ ] Upload to TestPyPI first — verify install from TestPyPI works
- [ ] Set version to desired release number (e.g., `0.1.0`)
- [ ] Commit, tag (`v0.1.0`), and push
- [ ] Verify GitHub Actions publishes to PyPI successfully
- [ ] Verify `pip install markdown-os` works from PyPI

---

## Success Criteria

### Core Functionality
✅ `pip install markdown-os` installs the package from PyPI
✅ `markdown-os open <file.md>` works after pip install (no repo clone needed)
✅ `markdown-os example --open` works after pip install
✅ All static assets (HTML, CSS, JS) are included in the wheel
✅ Templates directory is included in the wheel

### Versioning
✅ `markdown_os.__version__` returns the correct version string
✅ Version is sourced from `pyproject.toml` (single source of truth)

### CI/CD
✅ Pushing a `v*` tag triggers the publish workflow
✅ Tests run before publishing (publish blocked if tests fail)
✅ Package is published to PyPI via trusted publishing (no stored secrets)

### Metadata
✅ PyPI project page displays description, license, classifiers, and links
✅ README renders correctly on PyPI
✅ License shows as Apache 2.0

### Documentation
✅ README includes pip/uv install instructions
✅ Release process is documented in the feature plan
