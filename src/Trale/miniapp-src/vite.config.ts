import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { rmSync } from 'fs'
import { resolve } from 'path'

// Vite's emptyOutDir:true fails when root-owned files exist in wwwroot (EACCES).
// This plugin removes only the agent-owned assets/ subdir before each build,
// preventing stale fingerprinted bundles from accumulating. Ref #528.
function cleanAssetsPlugin(): Plugin {
  return {
    name: 'clean-assets',
    buildStart() {
      const assetsDir = resolve(process.cwd(), '../wwwroot/assets')
      rmSync(assetsDir, { recursive: true, force: true })
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
