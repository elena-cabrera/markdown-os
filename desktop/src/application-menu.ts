export function shouldInstallApplicationMenu(platform: NodeJS.Platform): boolean {
  return platform !== "win32";
}
