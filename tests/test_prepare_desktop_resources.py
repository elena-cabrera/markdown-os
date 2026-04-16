from __future__ import annotations

import pytest

from scripts.prepare_desktop_resources import (
    backend_binary_name,
    normalize_platform_name,
    resolve_target_platform,
)


def test_normalize_platform_name_maps_known_aliases() -> None:
    assert normalize_platform_name("windows") == "win32"
    assert normalize_platform_name("macos") == "darwin"
    assert normalize_platform_name("linux") == "linux"


def test_resolve_target_platform_prefers_explicit_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MARKDOWN_OS_DESKTOP_TARGET", "windows")
    assert resolve_target_platform() == "win32"


def test_backend_binary_name_windows_uses_exe() -> None:
    assert backend_binary_name("win32") == "markdown-os-backend.exe"


def test_backend_binary_name_macos_uses_plain_binary_name() -> None:
    assert backend_binary_name("darwin") == "markdown-os-backend"
