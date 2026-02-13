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
