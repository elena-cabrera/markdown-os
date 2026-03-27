#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
import struct
import zlib
from pathlib import Path


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)


def write_png_rgba(path: Path, width: int, height: int, rgba: bytes) -> None:
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type: None
        start = y * stride
        raw.extend(rgba[start : start + stride])

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png.extend(png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
    png.extend(png_chunk(b"IDAT", zlib.compress(bytes(raw), level=9)))
    png.extend(png_chunk(b"IEND", b""))
    path.write_bytes(bytes(png))


def draw_icon(output_png: Path, output_ico: Path, size: int = 1024) -> None:
    background = (0x1C, 0x1C, 0x1E, 0xFF)
    foreground = (0xFF, 0xFF, 0xFF, 0xFF)
    radius = int(size * 0.18)

    pixels = bytearray(size * size * 4)

    def set_pixel(x: int, y: int, color: tuple[int, int, int, int]) -> None:
        if x < 0 or y < 0 or x >= size or y >= size:
            return
        idx = (y * size + x) * 4
        pixels[idx : idx + 4] = bytes(color)

    def fill_circle(cx: int, cy: int, r: int, color: tuple[int, int, int, int]) -> None:
        r2 = r * r
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r2:
                    set_pixel(cx + dx, cy + dy, color)

    def draw_thick_line(
        x0: int, y0: int, x1: int, y1: int, thickness: int, color: tuple[int, int, int, int]
    ) -> None:
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            t = step / steps
            x = int(round(x0 + (x1 - x0) * t))
            y = int(round(y0 + (y1 - y0) * t))
            fill_circle(x, y, thickness // 2, color)

    # Rounded-square background.
    for y in range(size):
        for x in range(size):
            if radius <= x < size - radius or radius <= y < size - radius:
                set_pixel(x, y, background)
                continue
            # Corners.
            cx = radius if x < radius else size - radius - 1
            cy = radius if y < radius else size - radius - 1
            if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius:
                set_pixel(x, y, background)

    # Stylized "M" glyph.
    stroke = int(size * 0.10)
    left_x = int(size * 0.23)
    right_x = int(size * 0.77)
    top_y = int(size * 0.27)
    bottom_y = int(size * 0.76)
    mid_left_x = int(size * 0.43)
    mid_right_x = int(size * 0.57)
    mid_y = int(size * 0.58)

    draw_thick_line(left_x, bottom_y, left_x, top_y, stroke, foreground)
    draw_thick_line(left_x, top_y, mid_left_x, mid_y, stroke, foreground)
    draw_thick_line(mid_left_x, mid_y, mid_right_x, mid_y, stroke, foreground)
    draw_thick_line(mid_right_x, mid_y, right_x, top_y, stroke, foreground)
    draw_thick_line(right_x, top_y, right_x, bottom_y, stroke, foreground)

    write_png_rgba(output_png, size, size, bytes(pixels))

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


def ensure_icons(build_dir: Path) -> None:
    output_png = build_dir / "icon.png"
    output_ico = build_dir / "icon.ico"

    dimensions = read_png_dimensions(output_png)
    png_is_large_enough = dimensions is not None and dimensions[0] >= 512 and dimensions[1] >= 512

    if png_is_large_enough and output_ico.exists():
        return

    draw_icon(output_png, output_ico)


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

    ensure_icons(build_dir)
    copy_uv_binary(build_dir)
    print(f"Prepared desktop build resources in {build_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
