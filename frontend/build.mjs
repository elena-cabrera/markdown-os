import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/tiptap-bundle.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'TipTapBundle',
  outfile: '../markdown_os/static/js/vendor/tiptap-bundle.min.js',
  target: ['es2020'],
});
