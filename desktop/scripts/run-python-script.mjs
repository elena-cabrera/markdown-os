import { spawnSync } from "node:child_process";

const scriptPath = process.argv[2];
const scriptArgs = process.argv.slice(3);

if (!scriptPath) {
  console.error("Expected a Python script path.");
  process.exit(1);
}

const envUv = process.env.UV;
const envPython = process.env.PYTHON;
const candidates = [
  ...(envUv ? [[envUv, "run", "python"]] : []),
  ["uv", "run", "python"],
  ...(envPython ? [[envPython]] : []),
  ...(process.platform === "win32"
    ? [
        ["python"],
        ["py", "-3"],
      ]
    : [["python3"], ["python"]]),
];

for (const [command, ...prefixArgs] of candidates) {
  const result = spawnSync(command, [...prefixArgs, scriptPath, ...scriptArgs], {
    stdio: "inherit",
  });

  if (!result.error) {
    process.exit(result.status === null ? 0 : result.status);
  }

  if (result.error.code !== "ENOENT") {
    console.error(result.error.message);
    process.exit(1);
  }
}

console.error("Could not find a Python launcher. Set PYTHON or install Python 3.");
process.exit(1);
