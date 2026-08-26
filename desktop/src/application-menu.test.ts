import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildApplicationMenuTemplate,
  buildEditorContextMenuTemplate,
  collectMenuRoles,
  EDIT_MENU_ROLES,
  shouldInstallApplicationMenu,
} from "./application-menu.js";

const actions = {
  onOpen: () => undefined,
  onBackToPicker: () => undefined,
};

describe("shouldInstallApplicationMenu", () => {
  it("shows the menu bar on macOS and hides it on Windows", () => {
    assert.equal(shouldInstallApplicationMenu("darwin"), true);
    assert.equal(shouldInstallApplicationMenu("win32"), false);
    assert.equal(shouldInstallApplicationMenu("linux"), true);
  });
});

describe("buildApplicationMenuTemplate", () => {
  it("includes clipboard roles on macOS so Cmd+C writes to the system clipboard", () => {
    const roles = collectMenuRoles(buildApplicationMenuTemplate("darwin", actions));
    assert.equal(roles.includes("appMenu"), true);
    for (const role of EDIT_MENU_ROLES) {
      assert.equal(roles.includes(role), true, `missing Edit role: ${role}`);
    }
  });

  it("includes clipboard roles on Windows so Ctrl+C still works without a visible menu bar", () => {
    const roles = collectMenuRoles(buildApplicationMenuTemplate("win32", actions));
    assert.equal(roles.includes("appMenu"), false);
    assert.equal(roles.includes("quit"), true);
    for (const role of EDIT_MENU_ROLES) {
      assert.equal(roles.includes(role), true, `missing Edit role: ${role}`);
    }
  });
});

describe("buildEditorContextMenuTemplate", () => {
  it("offers copy for a read-only selection", () => {
    const items = buildEditorContextMenuTemplate({
      isEditable: false,
      selectionText: "copied text",
      editFlags: {
        canUndo: false,
        canRedo: false,
        canCut: false,
        canCopy: true,
        canPaste: false,
        canSelectAll: true,
      },
    });
    assert.deepEqual(collectMenuRoles(items), ["copy"]);
  });

  it("offers cut, copy, and paste inside the editor", () => {
    const roles = collectMenuRoles(
      buildEditorContextMenuTemplate({
        isEditable: true,
        selectionText: "hello",
        editFlags: {
          canUndo: true,
          canRedo: false,
          canCut: true,
          canCopy: true,
          canPaste: true,
          canSelectAll: true,
        },
      }),
    );
    assert.deepEqual(roles, ["undo", "redo", "cut", "copy", "paste", "selectAll"]);
  });

  it("hides the context menu when nothing can be copied", () => {
    const items = buildEditorContextMenuTemplate({
      isEditable: false,
      selectionText: "   ",
      editFlags: {
        canUndo: false,
        canRedo: false,
        canCut: false,
        canCopy: false,
        canPaste: false,
        canSelectAll: false,
      },
    });
    assert.deepEqual(items, []);
  });
});
