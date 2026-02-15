# Markdown-OS

Markdown-OS is a local, developer-focused markdown editor served by FastAPI and launched from a Typer CLI.

## Read-first workflow

- Files open in `Preview` mode by default for safer browsing.
- Switch to `Edit` when you want to type.
- Switching from `Edit` to `Preview` auto-saves changes when there is no external conflict.
- If the file changed externally and you have unsaved edits, Markdown-OS shows a conflict dialog:
  - `Save My Changes` overwrites disk with your editor content.
  - `Discard My Changes` reloads content from disk.
  - `Cancel` keeps you in edit mode with unsaved changes intact.
- External file changes auto-reload without prompts when safe:
  - always in preview mode
  - in edit mode when there are no unsaved changes

## Install dependencies

```bash
uv sync
```

## Run

```bash
uv run markdown-os open ./notes.md
```

If port `8000` is occupied, Markdown-OS auto-selects the next available port.

## Theme toggle

- The editor detects your system color preference on first load.
- Use the sun/moon toggle in the top-right header to switch between light and dark themes.
- Manual selection is persisted in `localStorage` and restored on reload.

## Generate a showcase file

```bash
# Create example.md in current directory
uv run markdown-os example

# Create at a custom location
uv run markdown-os example ./docs/showcase.md

# Generate and open immediately
uv run markdown-os example --open
```
