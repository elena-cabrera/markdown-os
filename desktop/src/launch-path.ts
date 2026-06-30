/**
 * Helpers for resolving markdown paths passed during desktop app launch.
 */

const MARKDOWN_PATH_PATTERN = /\.(md|markdown)$/i;

/**
 * Determine whether a path points to a markdown file.
 *
 * Args:
 * - candidate (string): File path candidate from argv or OS launch metadata.
 *
 * Returns:
 * - boolean: True when the path ends with a markdown extension.
 */
export function isMarkdownPath(candidate: string): boolean {
  return MARKDOWN_PATH_PATTERN.test(candidate);
}

/**
 * Find the first markdown file path in a process argv list.
 *
 * Args:
 * - argv (string[]): Raw process arguments, including the executable path.
 *
 * Returns:
 * - string | null: First markdown file path, or null when none is present.
 */
export function findMarkdownPathInArgv(argv: string[]): string | null {
  for (const entry of argv.slice(1)) {
    if (!entry || entry.startsWith("-")) {
      continue;
    }
    if (isMarkdownPath(entry)) {
      return entry;
    }
  }
  return null;
}

/**
 * Remember a launch path unless one is already queued.
 *
 * Args:
 * - current (string | null): Existing queued launch path.
 * - next (string): Newly discovered launch path.
 *
 * Returns:
 * - string | null: Updated queued launch path.
 */
export function queueLaunchPath(
  current: string | null,
  next: string,
): string | null {
  if (current || !next) {
    return current;
  }
  return next;
}
