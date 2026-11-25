import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve('src/renderer'),
  plugins: [react()],
  server: { port: 1420, strictPort: true },
  build: {
    outDir: resolve('dist-tauri'),
    emptyOutDir: true,
    rollupOptions: { input: resolve('src/renderer/tauri.html') }
  }
})
