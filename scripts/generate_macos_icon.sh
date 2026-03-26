#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_SOURCE="$ROOT_DIR/markdown_os/static/favicon.svg"
SOURCE_PATH="${1:-$DEFAULT_SOURCE}"
BUILD_DIR="$ROOT_DIR/desktop/build"
ICONSET_DIR="$BUILD_DIR/icon.iconset"
OUTPUT_PNG="$BUILD_DIR/icon.png"
OUTPUT_ICNS="$BUILD_DIR/icon.icns"

if [[ ! -f "$SOURCE_PATH" ]]; then
  echo "Icon source not found: $SOURCE_PATH" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

EXTENSION="${SOURCE_PATH##*.}"
EXTENSION="${EXTENSION:l}"
RASTER_SOURCE=""

if [[ "$EXTENSION" == "png" ]]; then
  RASTER_SOURCE="$SOURCE_PATH"
elif [[ "$EXTENSION" == "svg" ]]; then
  qlmanage -t -s 1024 -o "$TMP_DIR" "$SOURCE_PATH" >/dev/null
  RASTER_SOURCE="$(find "$TMP_DIR" -maxdepth 1 -name '*.png' | head -n 1)"
  if [[ -z "$RASTER_SOURCE" ]]; then
    echo "macOS Quick Look could not render $SOURCE_PATH to PNG." >&2
    echo "Pass a 1024x1024 PNG explicitly: npm run icon:mac -- /absolute/path/to/icon.png" >&2
    exit 1
  fi
else
  echo "Unsupported icon source extension: .$EXTENSION" >&2
  echo "Use either an SVG or a 1024x1024 PNG." >&2
  exit 1
fi

cp "$RASTER_SOURCE" "$OUTPUT_PNG"

sizes=(16 32 128 256 512)
for size in "${sizes[@]}"; do
  sips -z "$size" "$size" "$OUTPUT_PNG" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
  double_size=$((size * 2))
  sips -z "$double_size" "$double_size" "$OUTPUT_PNG" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"

echo "Generated:"
echo "  $OUTPUT_PNG"
echo "  $OUTPUT_ICNS"
