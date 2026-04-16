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


def write_ico_from_pngs(png_files: list[Path], output_ico: Path) -> None:
    if not png_files:
        raise ValueError("Expected at least one PNG source file to build an ICO.")

    icon_header = struct.pack("<HHH", 0, 1, len(png_files))
    icon_dirs: list[bytes] = []
    icon_payloads: list[bytes] = []
    payload_offset = 6 + (16 * len(png_files))

    for png_file in png_files:
        png_data = png_file.read_bytes()
        dimensions = read_png_dimensions(png_file)
        if dimensions is None:
            raise ValueError(f"Invalid PNG file while creating ICO: {png_file}")

        width, height = dimensions
        if width > 256 or height > 256:
            raise ValueError(f"ICO PNG entries must be <= 256x256 pixels: {png_file}")

        width_byte = 0 if width == 256 else width
        height_byte = 0 if height == 256 else height

        icon_dirs.append(
            struct.pack(
                "<BBBBHHII",
                width_byte,
                height_byte,
                0,
                0,
                1,
                32,
                len(png_data),
                payload_offset,
            )
        )
        icon_payloads.append(png_data)
        payload_offset += len(png_data)

    output_ico.write_bytes(icon_header + b"".join(icon_dirs) + b"".join(icon_payloads))


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


def resolve_electron_binary(root: Path) -> Path:
    desktop_dir = root / "desktop"
    candidates: list[Path]

    if sys.platform == "win32":
        candidates = [
            desktop_dir / "node_modules" / ".bin" / "electron.cmd",
            desktop_dir / "node_modules" / "electron" / "dist" / "electron.exe",
        ]
    else:
        candidates = [
            desktop_dir / "node_modules" / "electron" / "dist" / "Electron.app" / "Contents" / "MacOS" / "Electron",
            desktop_dir / "node_modules" / "electron" / "dist" / "electron",
            desktop_dir / "node_modules" / ".bin" / "electron",
        ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    raise FileNotFoundError(f"Electron binary not found in expected locations under {desktop_dir}")


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
    electron_binary = resolve_electron_binary(root)
    render_script = root / "scripts" / "render_svg_to_png.mjs"
    electron_env = os.environ.copy()
    electron_env.pop("ELECTRON_RUN_AS_NODE", None)
    run([str(electron_binary), str(render_script), str(output_svg), str(output_png), "1024"], env=electron_env)

    dimensions = read_png_dimensions(output_png)
    png_is_large_enough = dimensions is not None and dimensions[0] >= 512 and dimensions[1] >= 512

    if not png_is_large_enough:
        raise ValueError(f"Desktop icon must be at least 512x512 pixels: {output_png}")

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_png_files: list[Path] = []
    for size in ico_sizes:
        ico_png = build_dir / f"icon-{size}.png"
        run([str(electron_binary), str(render_script), str(output_svg), str(ico_png), str(size)], env=electron_env)
        ico_png_files.append(ico_png)

    write_ico_from_pngs(ico_png_files, output_ico)


def copy_uv_binary(build_dir: Path) -> None:
    uv_path = shutil.which("uv")
    if not uv_path:
        print("warning: uv not found on PATH; desktop package will rely on system uv", file=sys.stderr)
        return

    source = Path(uv_path)
    destination_names = {source.name}
    if sys.platform == "win32":
        destination_names.update({"uv.exe", "uv"})

    for destination_name in destination_names:
        destination = build_dir / destination_name
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
