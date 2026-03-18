#!/usr/bin/env python3
"""Build the Markdown-OS desktop application.

This script:
1. Downloads vendor assets (if not already present)
2. Runs PyInstaller with the project spec file

Usage:
    python scripts/build_desktop.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENDOR_DIR = ROOT / "markdown_os" / "static" / "vendor"
SPEC_FILE = ROOT / "markdown_os.spec"


def ensure_vendor_assets() -> None:
    """Download vendor assets if the vendor directory is empty."""
    marker = VENDOR_DIR / "js" / "marked.min.js"
    if marker.exists():
        print("Vendor assets already present, skipping download.")
        return

    print("Downloading vendor assets...")
    download_script = ROOT / "scripts" / "download_vendor.py"
    subprocess.run([sys.executable, str(download_script)], check=True)


def run_pyinstaller() -> None:
    """Run PyInstaller with the project spec file."""
    print("\nRunning PyInstaller...")
    subprocess.run(
        [sys.executable, "-m", "PyInstaller", str(SPEC_FILE), "--noconfirm"],
        cwd=str(ROOT),
        check=True,
    )
    print("\nBuild complete! Output is in dist/Markdown-OS/")


def main() -> None:
    ensure_vendor_assets()
    run_pyinstaller()


if __name__ == "__main__":
    main()
