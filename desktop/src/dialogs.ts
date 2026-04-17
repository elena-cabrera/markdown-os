import { dialog, BrowserWindow } from "electron";

/**
 * Open a native markdown file picker dialog.
 *
 * Args:
 * - window (BrowserWindow): Parent Electron browser window for the dialog.
 *
 * Returns:
 * - Promise<string | null>: Absolute path to the selected markdown file, or null when cancelled.
 */
export async function pickMarkdownFile(
  window: BrowserWindow,
): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: "Open markdown file",
    properties: ["openFile"],
    filters: [
      {
        name: "Markdown",
        extensions: ["md", "markdown"],
      },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0] ?? null;
}

/**
 * Open a native folder picker dialog.
 *
 * Args:
 * - window (BrowserWindow): Parent Electron browser window for the dialog.
 *
 * Returns:
 * - Promise<string | null>: Absolute path to the selected folder, or null when cancelled.
 */
export async function pickWorkspaceFolder(
  window: BrowserWindow,
): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: "Open workspace folder",
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0] ?? null;
}

/**
 * Open a unified native picker that accepts both markdown files and folders.
 *
 * Args:
 * - window (BrowserWindow): Parent Electron browser window for the dialog.
 *
 * Returns:
 * - Promise<string | null>: Absolute path to the selected file or folder, or null when cancelled.
 */
export async function pickFileOrFolder(
  window: BrowserWindow,
): Promise<string | null> {
  if (process.platform !== "darwin") {
    const selection = await dialog.showMessageBox(window, {
      type: "question",
      title: "Open",
      message: "What would you like to open?",
      detail: "Windows and Linux cannot reliably pick both files and folders in one native dialog.",
      buttons: ["Markdown File", "Folder", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });

    if (selection.response === 0) {
      return pickMarkdownFile(window);
    }

    if (selection.response === 1) {
      return pickWorkspaceFolder(window);
    }

    return null;
  }

  const result = await dialog.showOpenDialog(window, {
    title: "Open file or folder",
    properties: ["openFile", "openDirectory"],
    filters: [
      {
        name: "Markdown",
        extensions: ["md", "markdown"],
      },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0] ?? null;
}

export { pickWorkspaceFolder as pickFolder };
