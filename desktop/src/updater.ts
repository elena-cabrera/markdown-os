const GITHUB_OWNER = "elena-cabrera";
const GITHUB_REPO = "markdown-os";
let dismissedUpdateVersion: string | null = null;

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface ReleaseInfo {
  version: string;
  url: string;
  assets: ReleaseAsset[];
}

export type DesktopUpdateInfo = ReleaseInfo;

function normalizeVersion(version: string): string {
  return version.replace(/^v/, "");
}

function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }
  return 0;
}

export function releaseFeedUrl(): string {
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
}

export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const response = await fetch(`${releaseFeedUrl()}/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      tag_name?: string;
      html_url?: string;
      assets?: ReleaseAsset[];
    };
    if (!payload.tag_name || !payload.html_url) {
      return null;
    }
    return {
      version: normalizeVersion(payload.tag_name),
      url: payload.html_url,
      assets: payload.assets || [],
    };
  } catch (_error) {
    return null;
  }
}

export async function checkForUpdate(
  currentVersion: string,
  dismissedVersion: string | null,
): Promise<ReleaseInfo | null> {
  const latest = await fetchLatestRelease();
  if (!latest) {
    return null;
  }
  if (dismissedVersion && normalizeVersion(dismissedVersion) === latest.version) {
    return null;
  }
  if (compareVersions(latest.version, currentVersion) <= 0) {
    return null;
  }
  return latest;
}

export function getDismissedVersion(): string | null {
  return dismissedUpdateVersion;
}

export function dismissVersion(version: string | null): void {
  dismissedUpdateVersion = version;
}

export async function openReleaseUrl(url: string): Promise<void> {
  void url;
}
