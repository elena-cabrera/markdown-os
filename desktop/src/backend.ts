import { randomUUID } from "node:crypto";
import fs from "node:fs";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import os from "node:os";
import path from "node:path";

export type BackendHandle = {
  process: ChildProcessWithoutNullStreams;
  url: string;
};

type StartBackendOptions = {
  projectRoot: string;
};

function buildDesktopRuntimePath(projectRoot: string): string {
  return path.join(projectRoot, "markdown_os", "desktop_runtime.py");
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function resolveUvExecutable(): string {
  const isWindows = process.platform === "win32";

  if (process.resourcesPath) {
    const packagedCandidates = isWindows
      ? [
          path.join(process.resourcesPath, "uv.exe"),
          path.join(process.resourcesPath, "uv"),
        ]
      : [path.join(process.resourcesPath, "uv")];
    for (const candidate of packagedCandidates) {
      if (fileExists(candidate)) {
        return candidate;
      }
    }
  }

  // Allow power users to override.
  const overridden =
    process.env.MARKDOWN_OS_UV_PATH ||
    process.env.UV_PATH ||
    process.env.OVERRIDE_UV_PATH;
  if (overridden && fileExists(overridden)) {
    return overridden;
  }

  // Common locations for uv installed via cargo/brew.
  const home = os.homedir();
  const candidates: string[] = [
    path.join(home, "AppData", "Local", "Programs", "uv", "uv.exe"),
    path.join(home, ".local", "bin", "uv.exe"),
    path.join(home, ".cargo", "bin", "uv"),
    path.join(home, ".cargo", "bin", "uv.exe"),
    path.join(home, ".local", "bin", "uv"),
    "/usr/local/bin/uv",
    "/opt/homebrew/bin/uv",
  ];

  for (const candidate of candidates) {
    if (fileExists(candidate)) {
      return candidate;
    }
  }

  // Fall back to PATH lookup (works in `npm run dev` / terminal runs).
  const pathCandidates = isWindows ? ["uv.exe", "uv"] : ["uv"];
  for (const pathCandidate of pathCandidates) {
    const probe = spawnSync(pathCandidate, ["--version"], { encoding: "utf-8" });
    if (!probe.error) {
      return pathCandidate;
    }
  }

  throw new Error(
    "Could not find a uv executable. Reinstall the desktop app or set MARKDOWN_OS_UV_PATH to a valid uv binary.",
  );
}

async function waitForReadyUrl(
  process: ChildProcessWithoutNullStreams,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stderr = "";

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const onStdout = (chunk: Buffer) => {
      const output = chunk.toString("utf-8");
      const readyLine = output
        .split(/\r?\n/)
        .find((line) => line.startsWith("MARKDOWN_OS_DESKTOP_READY "));
      if (!readyLine) {
        return;
      }

      cleanup();
      resolve(readyLine.replace("MARKDOWN_OS_DESKTOP_READY ", "").trim());
    };

    const onStderr = (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    };

    const onExit = (code: number | null) => {
      cleanup();
      reject(
        new Error(
          `Desktop backend exited before readiness. code=${code ?? "null"} stderr=${stderr}`,
        ),
      );
    };

    const cleanup = () => {
      process.stdout.off("data", onStdout);
      process.stderr.off("data", onStderr);
      process.off("exit", onExit);
      process.off("error", onError);
    };

    process.stdout.on("data", onStdout);
    process.stderr.on("data", onStderr);
    process.once("error", onError);
    process.once("exit", onExit);
  });
}

export async function startBackend(
  options: StartBackendOptions,
): Promise<BackendHandle> {
  const { projectRoot } = options;
  const desktopRuntimePath = buildDesktopRuntimePath(projectRoot);
  const requestId = randomUUID();

  const uvExecutable = resolveUvExecutable();
  const child = spawn(
    uvExecutable,
    ["run", "python", desktopRuntimePath, "--request-id", requestId],
    {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    },
  );

  const url = await waitForReadyUrl(child);
  return { process: child, url };
}

export async function waitForBackendReady(
  projectRoot: string,
): Promise<BackendHandle> {
  return startBackend({ projectRoot });
}

export async function stopBackend(
  backend: BackendHandle | null,
  timeoutMs = 5_000,
): Promise<void> {
  if (!backend) {
    return;
  }

  if (backend.process.killed || backend.process.exitCode !== null) {
    return;
  }

  backend.process.kill("SIGTERM");

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (!backend.process.killed && backend.process.exitCode === null) {
        backend.process.kill("SIGKILL");
      }
      resolve();
    }, timeoutMs);

    backend.process.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
