import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      // Explicitly include the graph page so CRXJS bundles its JS entry point.
      input: {
        graph: resolve(import.meta.dirname, 'src/graph/index.html'),
      },
    },
  },
})
