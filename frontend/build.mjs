import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(__dirname, "src", "tiptap-bundle.js");
const outFile = path.join(
  __dirname,
  "..",
  "markdown_os",
  "static",
  "js",
  "vendor",
  "tiptap-bundle.min.js",
);

await build({
  entryPoints: [entryPoint],
  outfile: outFile,
  bundle: true,
  format: "iife",
  globalName: "MarkdownOSTipTapBundle",
  minify: true,
  sourcemap: false,
  target: ["es2020"],
  legalComments: "none",
  charset: "utf8",
});
