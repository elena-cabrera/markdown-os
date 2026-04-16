import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

export type BackendHandle = {
  process: ChildProcessWithoutNullStreams;
  url: string;
};

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function backendBinaryName(): string {
  return process.platform === "win32"
    ? "markdown-os-backend.exe"
    : "markdown-os-backend";
}

function resolveBackendExecutable(): string {
  const backendName = backendBinaryName();

  const overridden =
    process.env.MARKDOWN_OS_BACKEND_PATH ||
    process.env.MARKDOWN_OS_PYTHON_BACKEND_PATH;
  if (overridden && fileExists(overridden)) {
    return overridden;
  }

  const candidateRoots = [
    ...(process.resourcesPath
      ? [
          path.join(process.resourcesPath, "backend"),
          path.join(process.resourcesPath, "build", "backend"),
        ]
      : []),
    path.resolve(__dirname, "..", "build", "backend"),
  ];

  for (const root of candidateRoots) {
    const candidate = path.join(root, backendName);
    if (fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Could not find the bundled desktop backend. Reinstall the desktop app or set MARKDOWN_OS_BACKEND_PATH.",
  );
}

function backendWorkingDirectory(backendExecutable: string): string {
  const isWindows = process.platform === "win32";
  const backendDir = path.dirname(backendExecutable);
  if (isWindows || !process.resourcesPath) {
    return backendDir;
  }
  return process.resourcesPath;
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

export async function startBackend(): Promise<BackendHandle> {
  const requestId = randomUUID();
  const backendExecutable = resolveBackendExecutable();

  const child = spawn(
    backendExecutable,
    ["--request-id", requestId],
    {
      cwd: backendWorkingDirectory(backendExecutable),
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

export async function waitForBackendReady(): Promise<BackendHandle> {
  return startBackend();
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
