# Markdown-OS

Markdown-OS is a local, developer-focused markdown editor served by FastAPI and launched from a Typer CLI.

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
