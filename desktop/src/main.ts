import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs";

import {
  startBackend,
  stopBackend,
  type BackendHandle,
} from "./backend";
import { pickMarkdownFile, pickWorkspaceFolder } from "./dialogs";
import {
  addRecent,
  clearRecent,
  listRecents,
  type RecentEntry,
} from "./recents";
import {
  dismissVersion,
  getDismissedVersion,
  checkForUpdate,
  openReleaseUrl,
  releaseFeedUrl,
} from "./updater";

let mainWindow: BrowserWindow | null = null;
let backendHandle: BackendHandle | null = null;
let pendingOpenPath: string | null = null;

function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function getBuildIconPath(filename: string): string {
  return path.resolve(__dirname, "..", "build", filename);
}

function applyMacDockIcon(): void {
  if (process.platform !== "darwin" || !app.dock) {
    return;
  }

  const dockIconPath = getBuildIconPath("icon.png");
  if (!fs.existsSync(dockIconPath)) {
    return;
  }

  app.dock.setIcon(dockIconPath);
}

function currentWindow(): BrowserWindow {
  if (!mainWindow) {
    throw new Error("Main window has not been created.");
  }
  return mainWindow;
}

async function sendWorkspaceToRenderer(filePath: string): Promise<void> {
  if (!mainWindow) {
    pendingOpenPath = filePath;
    return;
  }

  await mainWindow.webContents.executeJavaScript(
    `
      window.MarkdownOS?.desktopShell?.openWorkspace?.(${JSON.stringify(filePath)});
    `,
    true,
  );
  addRecent(
    filePath,
    filePath.endsWith(".md") || filePath.endsWith(".markdown") ? "file" : "folder",
  );
}

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Open File",
          click: async () => {
            const selectedPath = await pickMarkdownFile(currentWindow());
            if (!selectedPath) {
              return;
            }
            await sendWorkspaceToRenderer(selectedPath);
          },
        },
        {
          label: "Open Folder",
          click: async () => {
            const selectedPath = await pickWorkspaceFolder(currentWindow());
            if (!selectedPath) {
              return;
            }
            await sendWorkspaceToRenderer(selectedPath);
          },
        },
        {
          label: "Back to Picker",
          click: async () => {
            await currentWindow().webContents.executeJavaScript(
              `
                window.MarkdownOS?.desktopShell?.closeWorkspace?.();
              `,
              true,
            );
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
  ]);
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    icon: process.platform === "darwin" ? undefined : getBuildIconPath("icon.png"),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(buildMenu());
  await mainWindow.loadURL(backendHandle!.url);

  if (pendingOpenPath) {
    const nextPath = pendingOpenPath;
    pendingOpenPath = null;
    await sendWorkspaceToRenderer(nextPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle("desktop:pick-file", async () => pickMarkdownFile(currentWindow()));
  ipcMain.handle("desktop:pick-folder", async () => pickWorkspaceFolder(currentWindow()));
  ipcMain.handle("desktop:list-recents", async () => listRecents());
  ipcMain.handle("desktop:open-recent", async (_event, targetPath: string) => {
    await sendWorkspaceToRenderer(targetPath);
    return { canceled: false, path: targetPath };
  });
  ipcMain.handle("desktop:clear-recent", async (_event, targetPath: string) => {
    clearRecent(targetPath);
  });
  ipcMain.handle("desktop:open-external", async (_event, targetUrl: string) => {
    await openReleaseUrl(targetUrl);
  });
  ipcMain.handle("desktop:get-platform", async () => process.platform);
  ipcMain.handle("desktop:get-app-version", async () => app.getVersion());
  ipcMain.handle("desktop:get-release-feed-url", async () => releaseFeedUrl());
  ipcMain.handle("desktop:check-for-updates", async () =>
    checkForUpdate(app.getVersion(), getDismissedVersion()),
  );
  ipcMain.handle("desktop:get-dismissed-update-version", async () =>
    getDismissedVersion(),
  );
  ipcMain.handle("desktop:dismiss-update-version", async (_event, version: string) => {
    dismissVersion(version);
  });
}

async function bootstrap(): Promise<void> {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  applyMacDockIcon();
  registerIpcHandlers();
  backendHandle = await startBackend({
    projectRoot: path.resolve(__dirname, "..", ".."),
  });
  await createMainWindow();

  app.on("second-instance", async (_event, commandLine) => {
    const candidatePath = commandLine.find((entry) =>
      entry.endsWith(".md") || entry.endsWith(".markdown"),
    );
    if (!candidatePath) {
      currentWindow().focus();
      return;
    }

    currentWindow().show();
    currentWindow().focus();
    await sendWorkspaceToRenderer(candidatePath);
  });

  app.on("open-file", async (event, filePath) => {
    event.preventDefault();
    await sendWorkspaceToRenderer(filePath);
  });

  app.on("before-quit", async () => {
    await stopBackend(backendHandle);
  });

  app.on("window-all-closed", async () => {
    if (process.platform !== "darwin") {
      await stopBackend(backendHandle);
      app.quit();
    }
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0 && backendHandle) {
      await createMainWindow();
    }
  });
}

void app.whenReady().then(bootstrap).catch(async (error: unknown) => {
  await dialog.showErrorBox(
    "Markdown-OS Desktop",
    error instanceof Error ? error.message : "Failed to launch desktop app.",
  );
  await stopBackend(backendHandle);
  app.quit();
});
