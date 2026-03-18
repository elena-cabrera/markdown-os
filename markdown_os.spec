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

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs

block_cipher = None

# Paths
ROOT = Path(SPECPATH)
PACKAGE_DIR = ROOT / "markdown_os"
STATIC_DIR = PACKAGE_DIR / "static"
TEMPLATES_DIR = PACKAGE_DIR / "templates"

hiddenimports = [
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
]

binaries = []
datas = [
    (str(STATIC_DIR), "markdown_os/static"),
    (str(TEMPLATES_DIR), "markdown_os/templates"),
]
upx_enabled = True
upx_exclude = []

if sys.platform == "win32":
    # pywebview's Windows backend imports pythonnet/clr_loader dynamically and
    # ships extra .NET / WebView2 DLLs that need to be collected explicitly.
    hiddenimports += [
        "clr",
        "pythonnet",
        "clr_loader",
        "webview.platforms.winforms",
    ]
    binaries += collect_dynamic_libs("pythonnet")
    binaries += collect_dynamic_libs("clr_loader")
    binaries += collect_dynamic_libs("webview")
    datas += collect_data_files("pythonnet", include_py_files=False)
    datas += collect_data_files("clr_loader", include_py_files=False)
    datas += collect_data_files("webview", include_py_files=False)

    # UPX can corrupt pythonnet / WebView2 managed assemblies in the frozen
    # Windows app, which then triggers runtime loader failures.
    upx_enabled = False
    upx_exclude = [
        "Python.Runtime.dll",
        "Microsoft.Web.WebView2.Core.dll",
        "Microsoft.Web.WebView2.WinForms.dll",
        "WebBrowserInterop.x64.dll",
        "WebBrowserInterop.x86.dll",
    ]

a = Analysis(
    [str(PACKAGE_DIR / "desktop.py")],
    pathex=[str(ROOT)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
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
    upx=upx_enabled,
    console=False,
    icon=None,  # Set to .ico (Windows) or .icns (macOS) path when available
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=upx_enabled,
    upx_exclude=upx_exclude,
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
