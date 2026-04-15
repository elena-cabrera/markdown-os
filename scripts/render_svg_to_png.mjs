import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";

const [, , inputSvgPath, outputPngPath, sizeArg] = process.argv;
const outputSize = Number.parseInt(sizeArg ?? "1024", 10);

if (!inputSvgPath || !outputPngPath) {
  console.error("Usage: electron render_svg_to_png.mjs <input.svg> <output.png> [size]");
  process.exit(1);
}

const svgMarkup = fs.readFileSync(inputSvgPath, "utf8");
const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }

      body > svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>${svgMarkup}</body>
</html>`;

app.commandLine.appendSwitch("disable-gpu");

const render = async () => {
  const window = new BrowserWindow({
    width: outputSize,
    height: outputSize,
    useContentSize: true,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: {
      offscreen: true,
      sandbox: false,
    },
  });

  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const image = await window.webContents.capturePage({
      x: 0,
      y: 0,
      width: outputSize,
      height: outputSize,
    });
    fs.mkdirSync(path.dirname(outputPngPath), { recursive: true });
    fs.writeFileSync(outputPngPath, image.toPNG());
  } finally {
    window.destroy();
    app.quit();
  }
};

app.whenReady().then(render).catch((error) => {
  console.error(error);
  app.exit(1);
});
