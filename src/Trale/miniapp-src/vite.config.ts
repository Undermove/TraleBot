import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { rmSync } from 'fs'
import { resolve } from 'path'

// Vite's emptyOutDir:true fails when root-owned assets.bak.old/ exists in wwwroot (EACCES).
// This plugin manually cleans the outputs we own (assets/ dir + index.html) before each
// build, preventing stale fingerprinted bundles from accumulating. Ref #528.
function cleanAssetsPlugin(): Plugin {
  return {
    name: 'clean-assets',
    buildStart() {
      const outDir = resolve(process.cwd(), '../wwwroot')
      rmSync(resolve(outDir, 'assets'), { recursive: true, force: true })
      rmSync(resolve(outDir, 'index.html'), { force: true })
    }
  }
}

export default defineConfig({
  plugins: [react(), cleanAssetsPlugin()],
  base: '/',
  build: {
    outDir: '../wwwroot',
    emptyOutDir: false
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:1402'
    }
  }
})
