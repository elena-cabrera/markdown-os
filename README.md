# Markdown-OS

[![PyPI version](https://img.shields.io/pypi/v/markdown-os)](https://pypi.org/project/markdown-os/)

Developer-focused markdown editor that runs as a local web server. Edit in the browser with live preview, Mermaid diagrams, syntax highlighting, and auto-save.

Desktop installers for macOS and Windows are published from GitHub Releases. The desktop app bundles the local server and opens with a picker-first workflow, so users do not need Python or a terminal after installation.

## Install

```bash
pip install markdown-os

```

Or with [uv](https://docs.astral.sh/uv/):

```bash
uv tool install markdown-os

```

To upgrade after installing with uv: `uv tool upgrade markdown-os`

## Desktop app

Download the latest desktop installers from GitHub Releases:

- macOS: `.dmg`
- Windows: `.exe`

The desktop app keeps the same editor UI, but launches in a native desktop shell with recent files/folders and native open dialogs.

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

Use the release helper from a clean working tree on the branch you want to publish (usually `master`):

```bash
uv run python scripts/release.py
```

It reads `[project].version` from `pyproject.toml`, asks whether to bump **major**, **minor**, or **patch**, updates the file, then runs `git add` / `git commit` (only `pyproject.toml`) / `git push -u origin <current-branch>` / annotated `git tag` / `git push origin <tag>`.

Useful options:

- `--dry-run` — print the planned version and git steps without changing files or running git.
- `-y` / `--yes` — skip the final confirmation prompt.
- `--version X.Y.Z` — set an exact version string and skip the bump menu.
- `--branch master` — push a specific branch (defaults to your current branch).
- `--repo /path/to/checkout` — run against another clone.
- `--allow-dirty` — proceed when other files are modified (still only commits `pyproject.toml`).

Manual sequence (equivalent when you are on `master`):

1. Bump `version` in `pyproject.toml`.
2. Commit and push: `git add pyproject.toml && git commit -m "chore: release X.Y.Z" && git push origin master`
3. Tag and push: `git tag -a vX.Y.Z -m "Release X.Y.Z" && git push origin vX.Y.Z`

The GitHub workflow runs on tag push and publishes to PyPI only when the tag matches the package version.