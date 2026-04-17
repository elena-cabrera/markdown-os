#!/usr/bin/env python3
"""Interactive release helper: bump ``pyproject.toml`` version, commit, push, tag."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import tomllib


@dataclass(frozen=True)
class SemVer:
    """Semantic version ``major.minor.patch`` (non-negative integers)."""

    major: int
    minor: int
    patch: int

    def __str__(self) -> str:
        """Return the dotted version string.

        Returns:
            str: Version in ``major.minor.patch`` form.
        """
        return f"{self.major}.{self.minor}.{self.patch}"

    def bump_patch(self) -> SemVer:
        """Return a new version with ``patch`` incremented by one.

        Returns:
            SemVer: The patch-bumped version.
        """
        return SemVer(self.major, self.minor, self.patch + 1)

    def bump_minor(self) -> SemVer:
        """Return a new version with ``minor`` incremented and ``patch`` reset.

        Returns:
            SemVer: The minor-bumped version.
        """
        return SemVer(self.major, self.minor + 1, 0)

    def bump_major(self) -> SemVer:
        """Return a new version with ``major`` incremented and lower parts reset.

        Returns:
            SemVer: The major-bumped version.
        """
        return SemVer(self.major + 1, 0, 0)


def _find_repo_root(start: Path) -> Path:
    """Walk upward from ``start`` until a ``pyproject.toml`` is found.

    Args:
        start (Path): Directory to begin searching from.

    Returns:
        Path: The repository root containing ``pyproject.toml``.

    Raises:
        FileNotFoundError: If no ``pyproject.toml`` is found above ``start``.
    """
    for candidate in (start, *start.parents):
        if (candidate / "pyproject.toml").is_file():
            return candidate
    raise FileNotFoundError("pyproject.toml not found in this directory or any parent.")


def _read_project_version(pyproject_path: Path) -> str:
    """Read ``project.version`` from a TOML file.

    Args:
        pyproject_path (Path): Absolute path to ``pyproject.toml``.

    Returns:
        str: The declared project version string.

    Raises:
        KeyError: If ``project`` or ``version`` is missing.
        ValueError: If the version is not a non-empty string.
    """
    data = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))
    project = data.get("project")
    if not isinstance(project, dict):
        raise KeyError("pyproject.toml is missing a [project] table.")
    version = project.get("version")
    if not isinstance(version, str) or not version.strip():
        raise ValueError("project.version must be a non-empty string.")
    return version.strip()


def _parse_semver(version: str) -> SemVer:
    """Parse ``major.minor.patch`` from a version string.

    Args:
        version (str): Full version, e.g. ``0.8.1`` or ``0.8.1a1`` (suffix ignored).

    Returns:
        SemVer: Parsed numeric components (suffixes are not preserved).

    Raises:
        ValueError: If the prefix is not three non-negative integers.
    """
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)", version)
    if not match:
        raise ValueError(
            f"Version {version!r} does not start with major.minor.patch (e.g. 0.8.1)."
        )
    return SemVer(int(match.group(1)), int(match.group(2)), int(match.group(3)))


def _format_bumped_version(current: str, bumped: SemVer) -> str:
    """Build the new version string, preserving any suffix after ``X.Y.Z``.

    Args:
        current (str): Existing ``project.version`` value.
        bumped (SemVer): New ``major.minor.patch`` components.

    Returns:
        str: Version string to write (base replaced; suffix kept if present).
    """
    match = re.match(r"^\d+\.\d+\.\d+(.*)$", current)
    suffix = match.group(1) if match else ""
    return f"{bumped}{suffix}"


def _set_project_version_in_pyproject_text(text: str, new_version: str) -> str:
    """Replace ``version =`` inside the ``[project]`` table only.

    Args:
        text (str): Full ``pyproject.toml`` content.
        new_version (str): New value for ``project.version``.

    Returns:
        str: Updated TOML text.

    Raises:
        ValueError: If no ``[project]`` block or ``version`` assignment is found.
    """
    lines = text.splitlines(keepends=True)
    in_project = False
    version_pattern = re.compile(r'^(\s*version\s*=\s*")([^"]*)("\s*)')

    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            in_project = stripped == "[project]"
            continue
        if not in_project:
            continue
        if stripped.startswith("[") and stripped != "[project]":
            in_project = False
            continue
        match = version_pattern.match(line)
        if match:
            lines[index] = f'{match.group(1)}{new_version}{match.group(3)}{line[match.end() :]}'
            return "".join(lines)

    raise ValueError("Could not find version = under [project] in pyproject.toml.")


def _run_git(args: list[str], *, cwd: Path) -> str:
    """Run a git subprocess and return stripped stdout.

    Args:
        args (list[str]): Arguments after ``git``.
        cwd (Path): Working directory for the command.

    Returns:
        str: Stripped standard output.

    Raises:
        subprocess.CalledProcessError: If git exits non-zero.
    """
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _git_status_porcelain(cwd: Path) -> str:
    """Return ``git status --porcelain`` output.

    Args:
        cwd (Path): Repository root.

    Returns:
        str: Porcelain status (may be empty if clean).
    """
    return _run_git(["status", "--porcelain"], cwd=cwd)


def _current_branch(cwd: Path) -> str:
    """Return the current branch name (or ``HEAD`` for detached).

    Args:
        cwd (Path): Repository root.

    Returns:
        str: Short branch name from ``git rev-parse``.
    """
    return _run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd)


def _remote_default_branch(cwd: Path) -> str | None:
    """Best-effort read of the remote default branch (e.g. ``master`` or ``main``).

    Args:
        cwd (Path): Repository root.

    Returns:
        str | None: Branch name without ``origin/`` prefix, or ``None`` if unknown.
    """
    try:
        ref = _run_git(["symbolic-ref", "refs/remotes/origin/HEAD"], cwd=cwd)
    except subprocess.CalledProcessError:
        return None
    if ref.startswith("refs/remotes/origin/"):
        return ref.removeprefix("refs/remotes/origin/")
    if ref.startswith("origin/"):
        return ref.removeprefix("origin/")
    return None


def _tag_exists(cwd: Path, tag: str) -> bool:
    """Return whether ``tag`` exists locally.

    Args:
        cwd (Path): Repository root.
        tag (str): Tag name (e.g. ``v1.2.3``).

    Returns:
        bool: ``True`` if ``git rev-parse`` succeeds for ``refs/tags/{tag}``.
    """
    result = subprocess.run(
        ["git", "rev-parse", f"refs/tags/{tag}"],
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def _prompt_choice(options: list[tuple[str, str]]) -> str:
    """Ask the user to pick one of several labeled choices by number.

    Args:
        options (list[tuple[str, str]]): Pairs ``(label, value)`` shown to the user.

    Returns:
        str: The ``value`` for the chosen option.

    Raises:
        SystemExit: On EOF or invalid input after retries.
    """
    for index, (label, _value) in enumerate(options, start=1):
        print(f"  {index}) {label}")
    while True:
        try:
            raw = input("Choose bump (number): ").strip()
        except EOFError:
            print("Aborted.", file=sys.stderr)
            raise SystemExit(1) from None
        if not raw.isdigit():
            print("Enter a number from the list.", file=sys.stderr)
            continue
        choice = int(raw)
        if 1 <= choice <= len(options):
            return options[choice - 1][1]
        print("Enter a number from the list.", file=sys.stderr)


def _confirm(message: str) -> bool:
    """Prompt for yes/no confirmation (default no).

    Args:
        message (str): Question text shown to the user.

    Returns:
        bool: ``True`` if the answer starts with ``y`` or ``Y``.
    """
    try:
        answer = input(f"{message} [y/N]: ").strip().lower()
    except EOFError:
        return False
    return answer in {"y", "yes"}


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    """Parse CLI arguments for the release script.

    Args:
        argv (list[str] | None): Argument vector; ``None`` uses process argv.

    Returns:
        argparse.Namespace: Parsed options.
    """
    parser = argparse.ArgumentParser(
        description="Bump pyproject.toml version, commit, push branch, tag, push tag."
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=None,
        help="Repository root (default: directory containing pyproject.toml, "
        "searching upward from cwd).",
    )
    parser.add_argument(
        "--version",
        dest="explicit_version",
        default=None,
        help="Skip bump menu and set project.version to this exact string.",
    )
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Skip the final confirmation before git writes.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print actions only; do not modify files or run mutating git commands.",
    )
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="Allow a dirty working tree (not recommended).",
    )
    parser.add_argument(
        "--branch",
        default=None,
        help="Push this branch name to origin (default: current branch).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    """Entry point: orchestrate version bump and release git operations.

    Args:
        argv (list[str] | None): CLI args; ``None`` means ``sys.argv[1:]``.

    Returns:
        None
    """
    args = _parse_args(argv)
    cwd = Path.cwd()
    repo_root = args.repo.resolve() if args.repo else _find_repo_root(cwd)
    pyproject = repo_root / "pyproject.toml"

    if not pyproject.is_file():
        print(f"Not found: {pyproject}", file=sys.stderr)
        raise SystemExit(1)

    try:
        _run_git(["rev-parse", "--git-dir"], cwd=repo_root)
    except subprocess.CalledProcessError:
        print(f"Not a git repository: {repo_root}", file=sys.stderr)
        raise SystemExit(1)

    status = _git_status_porcelain(repo_root)
    if status and not args.allow_dirty and not args.dry_run:
        print("Working tree is not clean. Commit or stash changes first.", file=sys.stderr)
        print("(Use --allow-dirty to override.)", file=sys.stderr)
        raise SystemExit(1)

    current_raw = _read_project_version(pyproject)
    try:
        current_semver = _parse_semver(current_raw)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) from exc

    if args.explicit_version:
        new_version = args.explicit_version.strip()
        if not new_version:
            print("--version must be non-empty.", file=sys.stderr)
            raise SystemExit(1)
    else:
        next_major = current_semver.bump_major()
        next_minor = current_semver.bump_minor()
        next_patch = current_semver.bump_patch()
        choice = _prompt_choice(
            [
                (f"Major → {next_major}", str(next_major)),
                (f"Minor → {next_minor}", str(next_minor)),
                (f"Patch → {next_patch}", str(next_patch)),
            ]
        )
        bumped = _parse_semver(choice)
        new_version = _format_bumped_version(current_raw, bumped)

    branch = args.branch or _current_branch(repo_root)
    if branch == "HEAD":
        print("Detached HEAD; checkout a branch or pass --branch.", file=sys.stderr)
        raise SystemExit(1)

    remote_branch = _remote_default_branch(repo_root)
    if remote_branch and branch != remote_branch:
        print(
            f"Note: pushing branch {branch!r} (remote default appears to be {remote_branch!r}).",
            file=sys.stderr,
        )

    tag_name = f"v{new_version}"

    if _tag_exists(repo_root, tag_name):
        print(f"Tag {tag_name!r} already exists locally. Remove it or pick another version.", file=sys.stderr)
        raise SystemExit(1)

    print(f"Repository: {repo_root}")
    print(f"Current version: {current_raw}")
    print(f"New version:     {new_version}")
    print(f"Branch push:     origin {branch}")
    print(f"Annotated tag:   {tag_name}")

    if args.dry_run:
        print("\nDry run: no file or git changes made.")
        raise SystemExit(0)

    if not args.yes and not _confirm("Proceed with bump, commit, push, and tag?"):
        print("Aborted.")
        raise SystemExit(1)

    original_text = pyproject.read_text(encoding="utf-8")
    updated_text = _set_project_version_in_pyproject_text(original_text, new_version)
    pyproject.write_text(updated_text, encoding="utf-8")

    commit_message = f"chore: release {new_version}"
    tag_message = f"Release {new_version}"

    try:
        subprocess.run(
            ["git", "add", "--", str(pyproject.relative_to(repo_root))],
            cwd=repo_root,
            check=True,
        )
        subprocess.run(
            [
                "git",
                "commit",
                "-m",
                commit_message,
                "--",
                str(pyproject.relative_to(repo_root)),
            ],
            cwd=repo_root,
            check=True,
        )
        subprocess.run(
            ["git", "push", "-u", "origin", branch],
            cwd=repo_root,
            check=True,
        )
        subprocess.run(
            ["git", "tag", "-a", tag_name, "-m", tag_message],
            cwd=repo_root,
            check=True,
        )
        subprocess.run(
            ["git", "push", "origin", tag_name],
            cwd=repo_root,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        print(f"Git command failed ({exc}).", file=sys.stderr)
        print("Your pyproject.toml may already be updated; fix git state and retry if needed.", file=sys.stderr)
        raise SystemExit(1) from exc

    print(f"\nReleased {new_version} as {tag_name} on origin/{branch}.")


if __name__ == "__main__":
    main()
