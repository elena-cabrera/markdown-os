# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for building Markdown-OS desktop application.

Usage:
    # First download vendor assets
    python scripts/download_vendor.py

    # Then build
    pyinstaller markdown_os.spec
"""

import sys
from pathlib import Path

block_cipher = None

# Paths
ROOT = Path(SPECPATH)
PACKAGE_DIR = ROOT / "markdown_os"
STATIC_DIR = PACKAGE_DIR / "static"
TEMPLATES_DIR = PACKAGE_DIR / "templates"

a = Analysis(
    [str(PACKAGE_DIR / "desktop.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        (str(STATIC_DIR), "markdown_os/static"),
        (str(TEMPLATES_DIR), "markdown_os/templates"),
    ],
    hiddenimports=[
        "markdown_os",
        "markdown_os.cli",
        "markdown_os.server",
        "markdown_os.file_handler",
        "markdown_os.directory_handler",
        "fastapi",
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "watchdog",
        "watchdog.observers",
        "portalocker",
        "webview",
        "pydantic",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Markdown-OS",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    icon=None,  # Set to .ico (Windows) or .icns (macOS) path when available
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="Markdown-OS",
)

# macOS app bundle
if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="Markdown-OS.app",
        icon=None,  # Set to .icns path when available
        bundle_identifier="com.markdown-os.app",
        info_plist={
            "CFBundleName": "Markdown-OS",
            "CFBundleDisplayName": "Markdown-OS",
            "CFBundleShortVersionString": "0.5.0",
            "CFBundleVersion": "0.5.0",
            "NSHighResolutionCapable": True,
            "CFBundleDocumentTypes": [
                {
                    "CFBundleTypeName": "Markdown Document",
                    "CFBundleTypeExtensions": ["md", "markdown"],
                    "CFBundleTypeRole": "Editor",
                }
            ],
        },
    )
