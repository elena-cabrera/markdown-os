# Markdown-OS

[![PyPI version](https://img.shields.io/pypi/v/markdown-os)](https://pypi.org/project/markdown-os/)

Developer-focused markdown editor that runs as a local web server. Edit in the browser with live preview, Mermaid diagrams, syntax highlighting, and auto-save.

## Install

```bash
pip install markdown-os
```

Or with [uv](https://docs.astral.sh/uv/):

```bash
uv tool install markdown-os
```

To upgrade after installing with uv: `uv tool upgrade markdown-os`

## Usage

Single file:

```bash
markdown-os open ./notes.md
```

Directory (markdown workspace):

```bash
markdown-os open ./my-notes
```

The app opens in your browser. If port 8000 is in use, the next port is tried. Options: `--host`, `--port`.

## Example file

Generate a showcase markdown file:

```bash
markdown-os example                    # creates example.md in current directory
markdown-os example ./docs/showcase.md # custom path
markdown-os example --open             # generate and open in the editor
```

Use `--force` / `-f` to overwrite an existing file without prompting.

## Publishing (maintainers)

1. Bump `version` in `pyproject.toml`.
2. Commit and push to `master`: `git add pyproject.toml && git commit -m "chore: release X.Y.Z" && git push origin master`
3. Tag that commit and push: `git tag -a vX.Y.Z -m "Release X.Y.Z" && git push origin vX.Y.Z`

The GitHub workflow runs on tag push and publishes to PyPI only when the tag matches the package version.

## Roadmap

- **Sidebar & tab redesign** — In folder mode: file tree and table of contents both visible; collapsible file tree; Edit/Read as a single pill toggle with icons.
- **Lock file cleanup** — Remove `.md.lock` files automatically when the server shuts down.
- **Image paste** — Paste or drag-and-drop images into the editor; images saved next to the markdown file and a markdown image reference inserted.
- **Math equations (KaTeX)** — Inline (`$...$`) and display (`$$...$$`) LaTeX math rendering in preview.
