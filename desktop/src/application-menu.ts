/**
 * Desktop application and editor context menus.
 *
 * Electron does not copy to the OS clipboard on macOS unless the application
 * menu includes Edit roles such as copy, cut, paste, and selectAll. The same
 * roles keep Ctrl+C/V/X working after the default menu is replaced on Windows.
 */

import type { MenuItemConstructorOptions } from "electron";

export const EDIT_MENU_ROLES = [
  "undo",
  "redo",
  "cut",
  "copy",
  "paste",
  "delete",
  "selectAll",
] as const;

export type ApplicationMenuPlatform = NodeJS.Platform;

export type ApplicationMenuActions = {
  onOpen: () => void | Promise<void>;
  onBackToPicker: () => void | Promise<void>;
};

export type EditorEditFlags = {
  canUndo: boolean;
  canRedo: boolean;
  canCut: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canSelectAll: boolean;
};

export type EditorContextMenuParams = {
  isEditable: boolean;
  selectionText: string;
  editFlags: EditorEditFlags;
};

type MenuTemplateItem = MenuItemConstructorOptions;

/**
 * Determine whether the native menu bar should be visible.
 *
 * Args:
 * - platform (ApplicationMenuPlatform): Host operating system identifier.
 *
 * Returns:
 * - boolean: True when the menu bar should be shown (macOS/Linux).
 */
export function shouldInstallApplicationMenu(
  platform: ApplicationMenuPlatform,
): boolean {
  return platform !== "win32";
}

/**
 * Build the standard Edit submenu that wires OS clipboard shortcuts.
 *
 * Returns:
 * - MenuTemplateItem: Edit menu with undo/redo and clipboard roles.
 */
export function buildEditMenuTemplate(): MenuTemplateItem {
  return {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "delete" },
      { type: "separator" },
      { role: "selectAll" },
    ],
  };
}

/**
 * Build the application menu template for the current platform.
 *
 * Args:
 * - platform (ApplicationMenuPlatform): Host operating system identifier.
 * - actions (ApplicationMenuActions): Click handlers for custom File items.
 *
 * Returns:
 * - MenuTemplateItem[]: Menu template including File and Edit menus.
 */
export function buildApplicationMenuTemplate(
  platform: ApplicationMenuPlatform,
  actions: ApplicationMenuActions,
): MenuTemplateItem[] {
  const fileMenu: MenuTemplateItem = {
    label: "File",
    submenu: [
      {
        label: "Open...",
        accelerator: "CmdOrCtrl+O",
        click: () => {
          void actions.onOpen();
        },
      },
      {
        label: "Back to Picker",
        click: () => {
          void actions.onBackToPicker();
        },
      },
      { type: "separator" },
      platform === "darwin" ? { role: "close" } : { role: "quit" },
    ],
  };

  const template: MenuTemplateItem[] = [];
  if (platform === "darwin") {
    template.push({ role: "appMenu" });
  }
  template.push(fileMenu, buildEditMenuTemplate());
  return template;
}

/**
 * Build a right-click editor context menu for copy/cut/paste.
 *
 * Args:
 * - params (EditorContextMenuParams): Selection and editability from Electron.
 *
 * Returns:
 * - MenuTemplateItem[]: Context menu items, or an empty list when none apply.
 */
export function buildEditorContextMenuTemplate(
  params: EditorContextMenuParams,
): MenuTemplateItem[] {
  const hasSelection = params.selectionText.length > 0;
  if (!params.isEditable && !hasSelection && !params.editFlags.canCopy) {
    return [];
  }

  if (!params.isEditable) {
    return [{ role: "copy", enabled: params.editFlags.canCopy }];
  }

  return [
    { role: "undo", enabled: params.editFlags.canUndo },
    { role: "redo", enabled: params.editFlags.canRedo },
    { type: "separator" },
    { role: "cut", enabled: params.editFlags.canCut },
    { role: "copy", enabled: params.editFlags.canCopy },
    { role: "paste", enabled: params.editFlags.canPaste },
    { type: "separator" },
    { role: "selectAll", enabled: params.editFlags.canSelectAll },
  ];
}

/**
 * Collect role identifiers from a menu template tree.
 *
 * Args:
 * - items (MenuTemplateItem[]): Menu template items to scan.
 *
 * Returns:
 * - string[]: Role names in depth-first order.
 */
export function collectMenuRoles(items: MenuTemplateItem[]): string[] {
  const roles: string[] = [];
  for (const item of items) {
    if (item.role) {
      roles.push(String(item.role));
    }
    if (Array.isArray(item.submenu)) {
      roles.push(...collectMenuRoles(item.submenu));
    }
  }
  return roles;
}
