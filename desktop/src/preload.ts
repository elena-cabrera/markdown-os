import { contextBridge, ipcRenderer } from "electron";

import type { ReleaseInfo } from "./updater";

const desktopBridge = {
  pickFile: (): Promise<string | null> => ipcRenderer.invoke("desktop:pick-file"),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke("desktop:pick-folder"),
  pickFileOrFolder: (): Promise<string | null> => ipcRenderer.invoke("desktop:pick-file-or-folder"),
  getPlatform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke("desktop:get-platform"),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("desktop:get-app-version"),
  getReleaseFeedUrl: (): Promise<string> => ipcRenderer.invoke("desktop:get-release-feed-url"),
  getDismissedUpdateVersion: (): Promise<string | null> =>
    ipcRenderer.invoke("desktop:get-dismissed-update-version"),
  dismissUpdateVersion: (version: string | null): Promise<void> =>
    ipcRenderer.invoke("desktop:dismiss-update-version", version),
  getLatestReleaseInfo: (): Promise<ReleaseInfo | null> =>
    ipcRenderer.invoke("desktop:get-latest-release-info"),
  openExternalUrl: (url: string): Promise<void> => ipcRenderer.invoke("desktop:open-external", url),
};

contextBridge.exposeInMainWorld("electronDesktop", desktopBridge);
