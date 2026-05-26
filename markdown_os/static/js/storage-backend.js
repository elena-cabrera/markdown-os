(() => {
  const WEB_DATABASE_NAME = "markdown-os-web";
  const WEB_DATABASE_VERSION = 1;
  const WEB_FILE_STORE = "files";
  const DEFAULT_WEB_FILE = "Welcome.md";
  const DEFAULT_WEB_CONTENT = `# Welcome to Markdown-OS Web

This free web workspace saves markdown files in this browser.

- Create files from the sidebar
- Edit with the same Markdown-OS WYSIWYG editor
- Export PDFs from the actions menu

Your local CLI and desktop app still save directly to your filesystem.
`;

  const namespace = (window.MarkdownOS = window.MarkdownOS || {});
  let storageBackendPromise = null;

  function runtimeForcesWebMode() {
    if (window.MarkdownOS_RUNTIME === "web") {
      return true;
    }

    const url = new URL(window.location.href);
    return url.searchParams.get("runtime") === "web";
  }

  async function readServerMode() {
    if (runtimeForcesWebMode()) {
      return "web";
    }

    try {
      const response = await fetch("/api/mode");
      if (!response.ok) {
        return "web";
      }
      const payload = await response.json();
      return payload.mode || "web";
    } catch (_error) {
      return "web";
    }
  }

  async function detectMode() {
    return readServerMode();
  }

  function contentUrlForMode(mode, filePath = null) {
    if (mode === "file") {
      return "/api/content";
    }
    if (!filePath) {
      return null;
    }
    return `/api/content?file=${encodeURIComponent(filePath)}`;
  }

  async function readJsonResponse(response, failureMessage) {
    if (!response.ok) {
      throw new Error(`${failureMessage} (${response.status})`);
    }
    return response.json();
  }

  function createHttpStorageBackend() {
    return {
      async detectMode() {
        return detectMode();
      },

      async getContent(filePath = null) {
        const mode = await detectMode();
        const requestUrl = contentUrlForMode(mode, filePath);
        if (!requestUrl) {
          throw new Error("Missing file path.");
        }
        const response = await fetch(requestUrl);
        return readJsonResponse(response, "Failed to load content");
      },

      async saveContent(content, filePath = null) {
        const mode = await detectMode();
        const payload = { content };
        if (mode === "folder") {
          payload.file = filePath;
        }
        const response = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return readJsonResponse(response, "Save failed");
      },

      async checkForExternalChanges(filePath, lastSavedContent) {
        try {
          const payload = await this.getContent(filePath);
          return (payload.content || "") !== lastSavedContent;
        } catch (error) {
          console.error("Failed to check for external changes.", error);
          return false;
        }
      },

      async getFileTree() {
        const response = await fetch("/api/file-tree");
        return readJsonResponse(response, "Failed to load file tree");
      },

      async createFile(path) {
        const response = await fetch("/api/files/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
        return readJsonResponse(response, "Failed to create file");
      },

      async renamePath(path, newName) {
        const response = await fetch("/api/files/rename", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, new_name: newName }),
        });
        return readJsonResponse(response, "Failed to rename path");
      },

      async deletePath(path) {
        const response = await fetch("/api/files/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
        return readJsonResponse(response, "Failed to delete file");
      },

      async uploadImage(file, filename) {
        const formData = new FormData();
        formData.append("file", file, filename);
        const response = await fetch("/api/images", {
          method: "POST",
          body: formData,
        });
        return readJsonResponse(response, "Upload failed");
      },

      async revealInExplorer() {
        await fetch("/api/reveal-in-explorer", { method: "POST" });
      },
    };
  }

  function normalizeWorkspacePath(path) {
    const normalized = String(path || "")
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
      .join("/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
      throw new Error("Path must stay inside the web workspace.");
    }
    return normalized;
  }

  function isMarkdownPath(path) {
    return /\.(md|markdown)$/i.test(path);
  }

  function metadataForFile(record) {
    return {
      path: record.path,
      relative_path: record.path,
      size_bytes: new Blob([record.content || ""]).size,
      modified_at: record.updatedAt,
    };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(WEB_DATABASE_NAME, WEB_DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(WEB_FILE_STORE)) {
          database.createObjectStore(WEB_FILE_STORE, { keyPath: "path" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Failed to open web storage."));
    });
  }

  function runFileStoreTransaction(mode, callback) {
    return openDatabase().then(
      (database) =>
        new Promise((resolve, reject) => {
          const transaction = database.transaction(WEB_FILE_STORE, mode);
          const store = transaction.objectStore(WEB_FILE_STORE);
          let callbackResult;

          transaction.oncomplete = () => {
            database.close();
            resolve(callbackResult);
          };
          transaction.onerror = () => {
            database.close();
            reject(transaction.error || new Error("Web storage transaction failed."));
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error || new Error("Web storage transaction aborted."));
          };

          callbackResult = callback(store);
        }),
    );
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Web storage request failed."));
    });
  }

  async function readAllRecords() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(WEB_FILE_STORE, "readonly");
      const store = transaction.objectStore(WEB_FILE_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("Failed to read web files."));
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error("Failed to read web files."));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error("Failed to read web files."));
      };
    });
  }

  async function readRecord(path) {
    const normalizedPath = normalizeWorkspacePath(path);
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(WEB_FILE_STORE, "readonly");
      const store = transaction.objectStore(WEB_FILE_STORE);
      const request = store.get(normalizedPath);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Failed to read web file."));
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error("Failed to read web file."));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error("Failed to read web file."));
      };
    });
  }

  async function writeRecord(path, content) {
    const normalizedPath = normalizeWorkspacePath(path);
    const record = {
      path: normalizedPath,
      content,
      updatedAt: new Date().toISOString(),
    };
    await runFileStoreTransaction("readwrite", (store) => {
      store.put(record);
    });
    return record;
  }

  async function ensureDefaultWorkspace() {
    const records = await readAllRecords();
    if (records.length > 0) {
      return;
    }
    await writeRecord(DEFAULT_WEB_FILE, DEFAULT_WEB_CONTENT);
  }

  function buildFileTree(records) {
    const root = {
      type: "folder",
      name: "Markdown-OS Web",
      path: "",
      children: [],
    };

    for (const record of records.filter((item) => isMarkdownPath(item.path))) {
      const parts = record.path.split("/");
      let currentNode = root;
      const folderParts = [];

      for (const folderName of parts.slice(0, -1)) {
        folderParts.push(folderName);
        const folderPath = folderParts.join("/");
        let folderNode = currentNode.children.find(
          (child) => child.type === "folder" && child.name === folderName,
        );
        if (!folderNode) {
          folderNode = {
            type: "folder",
            name: folderName,
            path: folderPath,
            children: [],
          };
          currentNode.children.push(folderNode);
        }
        currentNode = folderNode;
      }

      currentNode.children.push({
        type: "file",
        name: parts[parts.length - 1],
        path: record.path,
      });
    }

    sortTree(root);
    return root;
  }

  function sortTree(node) {
    for (const child of node.children || []) {
      if (child.type === "folder") {
        sortTree(child);
      }
    }

    node.children.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "folder" ? -1 : 1;
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Failed to read image."));
      reader.readAsDataURL(file);
    });
  }

  function renamedPathForPrefix(path, oldPrefix, newPrefix) {
    if (path === oldPrefix) {
      return newPrefix;
    }
    return `${newPrefix}/${path.slice(oldPrefix.length + 1)}`;
  }

  function createIndexedDbStorageBackend() {
    return {
      async detectMode() {
        return "web";
      },

      async getContent(filePath = DEFAULT_WEB_FILE) {
        await ensureDefaultWorkspace();
        const record = await readRecord(filePath);
        if (!record) {
          throw new Error(`File does not exist: ${filePath}`);
        }
        return {
          content: record.content || "",
          metadata: metadataForFile(record),
        };
      },

      async saveContent(content, filePath = DEFAULT_WEB_FILE) {
        const record = await writeRecord(filePath, content);
        return {
          status: "saved",
          metadata: metadataForFile(record),
        };
      },

      async checkForExternalChanges(filePath, lastSavedContent) {
        if (!filePath) {
          return false;
        }
        const record = await readRecord(filePath);
        return (record?.content || "") !== lastSavedContent;
      },

      async getFileTree() {
        await ensureDefaultWorkspace();
        return buildFileTree(await readAllRecords());
      },

      async createFile(path) {
        const normalizedPath = normalizeWorkspacePath(path);
        if (!isMarkdownPath(normalizedPath)) {
          throw new Error("Web workspace files must end with .md or .markdown.");
        }
        if (await readRecord(normalizedPath)) {
          throw new Error(`File already exists: ${normalizedPath}`);
        }
        await writeRecord(normalizedPath, "");
        return { path: normalizedPath };
      },

      async renamePath(path, newName) {
        const oldPath = normalizeWorkspacePath(path);
        const trimmedNewName = String(newName || "").trim();
        if (!trimmedNewName || trimmedNewName.includes("/") || trimmedNewName.includes("\\")) {
          throw new Error("New name must not be empty or contain path separators.");
        }

        const parent = oldPath.split("/").slice(0, -1).join("/");
        const newPath = parent ? `${parent}/${trimmedNewName}` : trimmedNewName;
        const records = await readAllRecords();
        const matchingRecords = records.filter(
          (record) => record.path === oldPath || record.path.startsWith(`${oldPath}/`),
        );
        if (matchingRecords.length === 0) {
          throw new Error(`Path does not exist: ${oldPath}`);
        }

        const isSingleFileRename =
          matchingRecords.length === 1 && matchingRecords[0].path === oldPath;
        if (isSingleFileRename && !isMarkdownPath(newPath)) {
          throw new Error("Web workspace files must end with .md or .markdown.");
        }

        if (
          records.some(
            (record) => record.path === newPath || record.path.startsWith(`${newPath}/`),
          )
        ) {
          throw new Error(`Destination already exists: ${newPath}`);
        }

        await runFileStoreTransaction("readwrite", (store) => {
          for (const record of matchingRecords) {
            store.delete(record.path);
            store.put({
              ...record,
              path: renamedPathForPrefix(record.path, oldPath, newPath),
              updatedAt: new Date().toISOString(),
            });
          }
        });

        return { path: newPath };
      },

      async deletePath(path) {
        const normalizedPath = normalizeWorkspacePath(path);
        const record = await readRecord(normalizedPath);
        if (!record) {
          throw new Error(`File does not exist: ${normalizedPath}`);
        }
        await runFileStoreTransaction("readwrite", (store) => {
          store.delete(normalizedPath);
        });
        return { ok: true };
      },

      async uploadImage(file) {
        return {
          path: await readFileAsDataUrl(file),
          filename: file?.name || "image",
        };
      },

      async revealInExplorer() {
        return { ok: false };
      },
    };
  }

  async function currentBackend() {
    if (!storageBackendPromise) {
      storageBackendPromise = detectMode().then((mode) =>
        mode === "web" ? createIndexedDbStorageBackend() : createHttpStorageBackend(),
      );
    }
    return storageBackendPromise;
  }

  window.MarkdownOS.storage = {
    detectMode,
    async getContent(filePath = null) {
      return (await currentBackend()).getContent(filePath);
    },
    async saveContent(content, filePath = null) {
      return (await currentBackend()).saveContent(content, filePath);
    },
    async checkForExternalChanges(filePath = null, lastSavedContent = "") {
      return (await currentBackend()).checkForExternalChanges(filePath, lastSavedContent);
    },
    async getFileTree() {
      return (await currentBackend()).getFileTree();
    },
    async createFile(path) {
      return (await currentBackend()).createFile(path);
    },
    async renamePath(path, newName) {
      return (await currentBackend()).renamePath(path, newName);
    },
    async deletePath(path) {
      return (await currentBackend()).deletePath(path);
    },
    async uploadImage(file, filename) {
      return (await currentBackend()).uploadImage(file, filename);
    },
    async revealInExplorer() {
      return (await currentBackend()).revealInExplorer();
    },
  };
})();
