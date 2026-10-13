import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { rmSync } from 'fs'
import { resolve } from 'path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LandingScreen from './src/screens/LandingScreen'
import { STATIC_HOME_MARK } from './src/staticHome'

// Vite's emptyOutDir:true fails when root-owned assets.bak.old/ exists in wwwroot (EACCES).
// This plugin manually cleans the outputs we own (assets/ dir + index.html) before each
// build, preventing stale fingerprinted bundles from accumulating. Ref #528.
// apply:'build' ensures cleanup only runs during production builds, not during vite dev.
function cleanAssetsPlugin(): Plugin {
  return {
    name: 'clean-assets',
    apply: 'build',
    buildStart() {
      const outDir = resolve(process.cwd(), '../wwwroot')
      rmSync(resolve(outDir, 'assets'), { recursive: true, force: true })
      rmSync(resolve(outDir, 'index.html'), { force: true })
    }
  }
}

// The landing is drawn by the app, so without JavaScript the home page was one paragraph: a search
// robot that does not run scripts had nothing to read and no links to follow. This puts the real
// landing — the same component, rendered here at build time — into index.html as plain HTML, next to
// the app's root. The app removes it when it starts (main.tsx), so a person never sees it twice.
function staticHomePlugin(): Plugin {
  return {
    name: 'static-home',
    transformIndexHtml(html) {
      if (!html.includes(STATIC_HOME_MARK)) throw new Error('index.html has no ' + STATIC_HOME_MARK)
      return html.replace(STATIC_HOME_MARK, renderToStaticMarkup(React.createElement(LandingScreen, {})))
    }
  }
}

export default defineConfig({
  plugins: [react(), cleanAssetsPlugin(), staticHomePlugin()],
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
