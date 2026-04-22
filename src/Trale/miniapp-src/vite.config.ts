import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
