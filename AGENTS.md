# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Markdown-OS is a self-contained Python CLI/web app with no external services (no DB, no Docker, no Node.js). All commands are documented in `CLAUDE.md`.

### Running the app

```bash
uv run markdown-os open <file-or-directory> --host 0.0.0.0 --port 8000
```

- The `--host 0.0.0.0` flag is needed in cloud VMs to allow browser access.
- The CLI auto-opens a browser; dbus errors in the logs from this are harmless — the server still works.
- If port 8000 is occupied, the server auto-increments to the next available port (check stdout for the actual URL).

### Tests, lint, build

- **Tests:** `uv run pytest` (61 tests, all async-compatible via pytest-asyncio)
- **Build:** No build step required — frontend is vanilla JS served as static files.
- **Lint:** No linter is configured in the project currently.

### Gotchas

- `.python-version` specifies Python 3.13; the update script installs it via `uv python install 3.13`.
- The project uses `uv` as its package manager (`uv.lock`). Never use `pip install` directly.
