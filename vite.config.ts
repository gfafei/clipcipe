import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Three MV3 build entries: background service worker, content script, and the
// side-panel React app. `background`/`content` are named so entryFileNames
// below can pin them to flat, predictable filenames that public/manifest.json
// references directly (["background.js"] / ["content.js"]). The side-panel
// html entry keeps Vite's default behavior of mirroring its source path
// relative to project root, so it lands at dist/src/sidepanel/index.html —
// matching manifest.json's side_panel.default_path.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' || chunk.name === 'content'
            ? '[name].js'
            : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
