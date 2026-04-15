#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_SOURCE="$ROOT_DIR/desktop/assets/icon.svg"
SOURCE_PATH="${1:-$DEFAULT_SOURCE}"
BUILD_DIR="$ROOT_DIR/desktop/build"
OUTPUT_PATH=""

if [[ ! -f "$SOURCE_PATH" ]]; then
  echo "Icon source not found: $SOURCE_PATH" >&2
  exit 1
fi

EXTENSION="${SOURCE_PATH##*.}"
EXTENSION="${EXTENSION:l}"
case "$EXTENSION" in
  svg)
    OUTPUT_PATH="$BUILD_DIR/icon.svg"
    ;;
  png)
    OUTPUT_PATH="$BUILD_DIR/icon.png"
    ;;
  *)
    echo "Unsupported icon source extension: .$EXTENSION" >&2
    echo "Use either an SVG or a PNG source asset." >&2
    exit 1
    ;;
esac

mkdir -p "$BUILD_DIR"
cp "$SOURCE_PATH" "$OUTPUT_PATH"

echo "Synced:"
echo "  $OUTPUT_PATH"
