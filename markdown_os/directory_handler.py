"""Directory and file tree management for Markdown-OS."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from markdown_os.file_handler import FileHandler
from markdown_os.file_handler import FileReadError, FileWriteError

MARKDOWN_EXTENSIONS = {".md", ".markdown"}


class DirectoryHandler:
    """Manage multiple markdown files within a directory."""

    def __init__(self, directory: Path) -> None:
        """
        Create a directory handler for a folder containing markdown files.

        Args:
        - directory (Path): Root directory path containing markdown files.

        Returns:
        - None: Initializes directory path and file handler cache.
        """

        self._directory = directory.expanduser().resolve()
        self._file_handlers: dict[str, FileHandler] = {}

    @property
    def directory(self) -> Path:
        """
        Expose the root directory path.

        Returns:
        - Path: The resolved directory path.
        """

        return self._directory

    def list_files(self, extensions: set[str] | None = None) -> list[Path]:
        """
        List all markdown files in the directory recursively.

        Args:
        - extensions (set[str] | None): File extensions to include.

        Returns:
        - list[Path]: Sorted markdown file paths relative to root directory.
        """

        allowed_extensions = {ext.lower() for ext in (extensions or MARKDOWN_EXTENSIONS)}
        files: list[Path] = []
        for candidate in self._directory.rglob("*"):
            if not candidate.is_file():
                continue
            if candidate.suffix.lower() not in allowed_extensions:
                continue
            if not candidate.resolve().is_relative_to(self._directory):
                continue
            files.append(candidate.relative_to(self._directory))

        return sorted(files, key=lambda relative_path: relative_path.as_posix().lower())

    def get_file_tree(self) -> dict[str, Any]:
        """
        Build a nested tree structure of markdown files and folders.

        Returns:
        - dict[str, Any]: Nested dictionary representing folder/file structure.
        """

        root: dict[str, Any] = {
            "type": "folder",
            "name": self._directory.name or ".",
            "path": "",
            "children": [],
        }

        for relative_file_path in self.list_files():
            current_node = root
            folder_parts: list[str] = []
            for folder_name in relative_file_path.parts[:-1]:
                folder_parts.append(folder_name)
                folder_path = Path(*folder_parts).as_posix()
                existing_folder = next(
                    (
                        child
                        for child in current_node["children"]
                        if child["type"] == "folder" and child["name"] == folder_name
                    ),
                    None,
                )

                if existing_folder is None:
                    existing_folder = {
                        "type": "folder",
                        "name": folder_name,
                        "path": folder_path,
                        "children": [],
                    }
                    current_node["children"].append(existing_folder)

                current_node = existing_folder

            current_node["children"].append(
                {
                    "type": "file",
                    "name": relative_file_path.name,
                    "path": relative_file_path.as_posix(),
                }
            )

        self._sort_tree_node(root)
        return root

    def get_file_handler(self, relative_path: str) -> FileHandler:
        """
        Get or create a FileHandler for a specific markdown file.

        Args:
        - relative_path (str): File path relative to the root directory.

        Returns:
        - FileHandler: File handler instance for the specified file.
        """

        normalized_path, absolute_path = self._resolve_relative_markdown_path(relative_path)
        cached_handler = self._file_handlers.get(normalized_path)
        if cached_handler is not None:
            return cached_handler

        file_handler = FileHandler(absolute_path)
        self._file_handlers[normalized_path] = file_handler
        return file_handler

    def validate_file_path(self, relative_path: str) -> bool:
        """
        Check if a relative path points to a valid markdown file in the directory.

        Args:
        - relative_path (str): File path relative to the root directory.

        Returns:
        - bool: True if file exists and is a markdown file within the directory.
        """

        try:
            self._resolve_relative_markdown_path(relative_path)
        except (FileNotFoundError, ValueError, OSError):
            return False
        return True

    def cleanup(self) -> None:
        """
        Clean up lock files for all cached file handlers.

        Args:
        - None (None): Iterates over all file handlers created during this session.

        Returns:
        - None: Cleanup has best-effort semantics and never raises.
        """

        for file_handler in self._file_handlers.values():
            file_handler.cleanup()

    def create_file(self, relative_path: str) -> Path:
        """Create an empty file in the workspace and return its absolute path."""

        _, absolute_path = self._resolve_workspace_path(relative_path)
        if absolute_path.exists():
            raise FileWriteError(f"File already exists: {absolute_path}")

        absolute_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            absolute_path.write_text("", encoding="utf-8")
        except OSError as exc:
            raise FileWriteError(f"Failed to create file: {absolute_path}") from exc

        return absolute_path

    def rename_path(self, relative_path: str, new_name: str) -> Path:
        """Rename a file or folder entry to a new name in the same parent directory."""

        if not new_name or "/" in new_name or "\\" in new_name:
            raise ValueError("New name must not be empty or contain path separators.")

        normalized_path, source = self._resolve_workspace_path(relative_path)
        if not source.exists():
            raise FileReadError(f"Path does not exist: {source}")

        destination = source.parent / new_name
        destination = destination.resolve()
        if not destination.is_relative_to(self._directory):
            raise ValueError("Destination escapes the workspace directory.")
        if destination.exists():
            raise FileWriteError(f"Destination already exists: {destination}")

        try:
            source.rename(destination)
        except OSError as exc:
            raise FileWriteError(f"Failed to rename path: {source}") from exc

        self._file_handlers.pop(normalized_path, None)
        return destination

    def delete_file(self, relative_path: str) -> None:
        """Delete a file in the workspace."""

        normalized_path, absolute_path = self._resolve_workspace_path(relative_path)
        if not absolute_path.exists():
            raise FileReadError(f"File does not exist: {absolute_path}")
        if absolute_path.is_dir():
            raise FileWriteError(f"Cannot delete directory: {absolute_path}")

        try:
            absolute_path.unlink()
        except OSError as exc:
            raise FileWriteError(f"Failed to delete file: {absolute_path}") from exc

        self._file_handlers.pop(normalized_path, None)

    def _resolve_relative_markdown_path(self, relative_path: str) -> tuple[str, Path]:
        """
        Resolve and validate a directory-relative markdown file path.

        Args:
        - relative_path (str): Candidate markdown file path relative to root.

        Returns:
        - tuple[str, Path]: Normalized POSIX relative path and absolute path.
        """

        raw_path = Path(relative_path.replace("\\", "/"))
        if raw_path.is_absolute():
            raise ValueError("Path must be relative to the workspace directory.")

        absolute_path = (self._directory / raw_path).resolve()
        if not absolute_path.is_relative_to(self._directory):
            raise ValueError("Path escapes the workspace directory.")

        if absolute_path.suffix.lower() not in MARKDOWN_EXTENSIONS:
            raise ValueError(f"Not a markdown file: {absolute_path}")
        if not absolute_path.exists() or not absolute_path.is_file():
            raise FileNotFoundError(f"File does not exist: {absolute_path}")

        normalized_path = absolute_path.relative_to(self._directory).as_posix()
        return normalized_path, absolute_path

    def _resolve_workspace_path(self, relative_path: str) -> tuple[str, Path]:
        """Resolve and validate a directory-relative path within the workspace root."""

        raw_path = Path(relative_path.replace("\\", "/"))
        if raw_path.is_absolute():
            raise ValueError("Path must be relative to the workspace directory.")

        absolute_path = (self._directory / raw_path).resolve()
        if not absolute_path.is_relative_to(self._directory):
            raise ValueError("Path escapes the workspace directory.")

        normalized_path = absolute_path.relative_to(self._directory).as_posix()
        return normalized_path, absolute_path

    def _sort_tree_node(self, node: dict[str, Any]) -> None:
        """
        Sort tree nodes recursively with folders first, then files.

        Args:
        - node (dict[str, Any]): Tree node containing optional children.

        Returns:
        - None: Node list is sorted in place.
        """

        children = node.get("children", [])
        for child in children:
            if child.get("type") == "folder":
                self._sort_tree_node(child)

        children.sort(
            key=lambda child: (
                child.get("type") != "folder",
                str(child.get("name", "")).lower(),
            )
        )
