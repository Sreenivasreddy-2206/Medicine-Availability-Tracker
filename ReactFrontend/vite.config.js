import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/medicine': 'http://localhost:3000',
      '/pharmacy': 'http://localhost:3000',
      '/admin': 'http://localhost:3000'
    }
  }
})
