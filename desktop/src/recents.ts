import Store from "electron-store";

export type RecentEntryType = "file" | "folder";

export interface RecentEntry {
  path: string;
  type: RecentEntryType;
  name: string;
  lastOpenedAt: string;
}

interface DesktopStoreSchema {
  recents: RecentEntry[];
  dismissedUpdateVersion: string | null;
}

const MAX_RECENTS = 12;

type DesktopStore = Store<DesktopStoreSchema> & {
  get<K extends keyof DesktopStoreSchema>(key: K, defaultValue?: DesktopStoreSchema[K]): DesktopStoreSchema[K];
  set<K extends keyof DesktopStoreSchema>(key: K, value: DesktopStoreSchema[K]): void;
};

const store = new Store<DesktopStoreSchema>({
  // `electron-store` is built on `conf`, which requires a `projectName` in newer versions.
  projectName: "markdown-os-desktop",
  name: "markdown-os-desktop",
  defaults: {
    recents: [],
    dismissedUpdateVersion: null,
  },
}) as DesktopStore;

function basename(targetPath: string): string {
  const normalized = targetPath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || targetPath;
}

export function listRecents(): RecentEntry[] {
  return store
    .get("recents", [])
    .filter((entry: RecentEntry) => Boolean(entry?.path && entry?.type))
    .slice(0, MAX_RECENTS);
}

export function addRecent(path: string, type: RecentEntryType): RecentEntry[] {
  const nextEntry: RecentEntry = {
    path,
    type,
    name: basename(path),
    lastOpenedAt: new Date().toISOString(),
  };

  const deduped = listRecents().filter((entry) => entry.path !== path);
  const nextRecents = [nextEntry, ...deduped].slice(0, MAX_RECENTS);
  store.set("recents", nextRecents);
  return nextRecents;
}

export function clearRecent(path: string): RecentEntry[] {
  const nextRecents = listRecents().filter((entry) => entry.path !== path);
  store.set("recents", nextRecents);
  return nextRecents;
}

export function getDismissedUpdateVersion(): string | null {
  return store.get("dismissedUpdateVersion", null);
}

export function dismissUpdateVersion(version: string | null): void {
  store.set("dismissedUpdateVersion", version);
}
