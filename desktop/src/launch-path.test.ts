import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  findMarkdownPathInArgv,
  isMarkdownPath,
  queueLaunchPath,
} from "./launch-path.js";

describe("isMarkdownPath", () => {
  it("accepts common markdown extensions", () => {
    assert.equal(isMarkdownPath("/tmp/notes.md"), true);
    assert.equal(isMarkdownPath("C:\\Users\\me\\README.markdown"), true);
    assert.equal(isMarkdownPath("/tmp/notes.MD"), true);
  });

  it("rejects non-markdown paths", () => {
    assert.equal(isMarkdownPath("/tmp/notes.txt"), false);
    assert.equal(isMarkdownPath("--request-id"), false);
  });
});

describe("findMarkdownPathInArgv", () => {
  it("returns the markdown path from Windows-style argv", () => {
    const path = findMarkdownPathInArgv([
      "C:\\Program Files\\Markdown-OS\\Markdown-OS.exe",
      "C:\\Users\\me\\notes\\readme.md",
    ]);
    assert.equal(path, "C:\\Users\\me\\notes\\readme.md");
  });

  it("returns the markdown path from Unix-style argv", () => {
    const path = findMarkdownPathInArgv([
      "/Applications/Markdown-OS.app/Contents/MacOS/Markdown-OS",
      "/Users/me/Documents/notes.md",
    ]);
    assert.equal(path, "/Users/me/Documents/notes.md");
  });

  it("ignores flags and returns null when no markdown path exists", () => {
    assert.equal(findMarkdownPathInArgv(["markdown-os", "--request-id", "abc"]), null);
    assert.equal(findMarkdownPathInArgv(["markdown-os"]), null);
  });
});

describe("queueLaunchPath", () => {
  it("stores the first launch path only", () => {
    assert.equal(queueLaunchPath(null, "/tmp/a.md"), "/tmp/a.md");
    assert.equal(queueLaunchPath("/tmp/a.md", "/tmp/b.md"), "/tmp/a.md");
    assert.equal(queueLaunchPath(null, ""), null);
  });
});
