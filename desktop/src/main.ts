import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import path from "node:path";

import {
  startBackend,
  stopBackend,
  type BackendHandle,
} from "./backend";
import { pickMarkdownFile, pickWorkspaceFolder, pickFileOrFolder } from "./dialogs";
import {
  findMarkdownPathInArgv,
  isMarkdownPath,
  queueLaunchPath,
} from "./launch-path";
import {
  dismissVersion,
  getDismissedVersion,
  checkForUpdate,
  openReleaseUrl,
  releaseFeedUrl,
} from "./updater";
import { shouldInstallApplicationMenu } from "./application-menu";

let mainWindow: BrowserWindow | null = null;
let backendHandle: BackendHandle | null = null;
let pendingOpenPath: string | null = null;

function rememberLaunchPath(filePath: string): void {
  pendingOpenPath = queueLaunchPath(pendingOpenPath, filePath);
}

function captureInitialLaunchPath(): void {
  const argvPath = findMarkdownPathInArgv(process.argv);
  if (argvPath) {
    rememberLaunchPath(argvPath);
  }
}

// macOS can emit open-file before app.whenReady(); queue the path immediately.
app.on("open-file", async (event, filePath) => {
  event.preventDefault();
  if (!isMarkdownPath(filePath)) {
    return;
  }

  if (!mainWindow) {
    rememberLaunchPath(filePath);
    return;
  }

  await sendWorkspaceToRenderer(filePath);
});

function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function getBuildIconPath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, filename);
  }
  return path.resolve(__dirname, "..", "build", filename);
}

function getWindowIconPath(): string | undefined {
  if (process.platform === "darwin") {
    return undefined;
  }
  if (process.platform === "win32") {
    return getBuildIconPath("icon.ico");
  }
  return getBuildIconPath("icon.png");
}

function currentWindow(): BrowserWindow {
  if (!mainWindow) {
    throw new Error("Main window has not been created.");
  }
  return mainWindow;
}

async function sendWorkspaceToRenderer(filePath: string): Promise<void> {
  if (!mainWindow) {
    rememberLaunchPath(filePath);
    return;
  }

  await mainWindow.webContents.executeJavaScript(
    `
      window.MarkdownOS?.desktopShell?.openWorkspace?.(${JSON.stringify(filePath)});
    `,
    true,
  );
}

function buildMenu(): Menu | null {
  if (!shouldInstallApplicationMenu(process.platform)) {
    return null;
  }

  return Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const selectedPath = await pickFileOrFolder(currentWindow());
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
    icon: getWindowIconPath(),
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
  ipcMain.handle("desktop:pick-file-or-folder", async () => pickFileOrFolder(currentWindow()));
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

  captureInitialLaunchPath();
  registerIpcHandlers();
  backendHandle = await startBackend();
  await createMainWindow();

  app.on("second-instance", async (_event, commandLine) => {
    const candidatePath = findMarkdownPathInArgv(commandLine);
    if (!candidatePath) {
      currentWindow().focus();
      return;
    }

    currentWindow().show();
    currentWindow().focus();
    await sendWorkspaceToRenderer(candidatePath);
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
