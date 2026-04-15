#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import struct
from pathlib import Path


def run(cmd: list[str], env: dict[str, str] | None = None) -> None:
    subprocess.run(cmd, check=True, env=env)


def write_ico_from_png(output_png: Path, output_ico: Path) -> None:
    png_data = output_png.read_bytes()
    icon_header = struct.pack("<HHH", 0, 1, 1)
    icon_dir = struct.pack(
        "<BBBBHHII",
        0,
        0,
        0,
        0,
        1,
        32,
        len(png_data),
        6 + 16,
    )
    output_ico.write_bytes(icon_header + icon_dir + png_data)


def read_png_dimensions(path: Path) -> tuple[int, int] | None:
    try:
        data = path.read_bytes()
    except FileNotFoundError:
        return None

    signature = b"\x89PNG\r\n\x1a\n"
    if len(data) < 24 or not data.startswith(signature):
        return None

    ihdr_offset = len(signature)
    if data[ihdr_offset + 4 : ihdr_offset + 8] != b"IHDR":
        return None

    width, height = struct.unpack(">II", data[ihdr_offset + 8 : ihdr_offset + 16])
    return width, height


def ensure_icons(root: Path, build_dir: Path) -> None:
    source_svg = root / "desktop" / "assets" / "icon.svg"
    if not source_svg.exists():
        raise FileNotFoundError(f"Desktop icon source not found: {source_svg}")

    output_png = build_dir / "icon.png"
    output_ico = build_dir / "icon.ico"
    output_svg = build_dir / "icon.svg"
    legacy_icns = build_dir / "icon.icns"
    legacy_iconset = build_dir / "icon.iconset"

    if legacy_icns.exists():
        legacy_icns.unlink()
    if legacy_iconset.exists():
        shutil.rmtree(legacy_iconset)

    shutil.copy2(source_svg, output_svg)
    electron_binary = root / "desktop" / "node_modules" / ".bin" / "electron"
    render_script = root / "scripts" / "render_svg_to_png.mjs"
    if not electron_binary.exists():
        raise FileNotFoundError(f"Electron binary not found: {electron_binary}")
    electron_env = os.environ.copy()
    electron_env.pop("ELECTRON_RUN_AS_NODE", None)
    run(
        [str(electron_binary), str(render_script), str(output_svg), str(output_png), "1024"],
        env=electron_env,
    )

    dimensions = read_png_dimensions(output_png)
    png_is_large_enough = dimensions is not None and dimensions[0] >= 512 and dimensions[1] >= 512

    if not png_is_large_enough:
        raise ValueError(f"Desktop icon must be at least 512x512 pixels: {output_png}")

    write_ico_from_png(output_png, output_ico)


def copy_uv_binary(build_dir: Path) -> None:
    uv_path = shutil.which("uv")
    if not uv_path:
        print("warning: uv not found on PATH; desktop package will rely on system uv", file=sys.stderr)
        return

    source = Path(uv_path)
    destination = build_dir / source.name
    shutil.copy2(source, destination)
    destination.chmod(0o755)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    build_dir = root / "desktop" / "build"
    build_dir.mkdir(parents=True, exist_ok=True)

    ensure_icons(root, build_dir)
    copy_uv_binary(build_dir)
    print(f"Prepared desktop build resources in {build_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
