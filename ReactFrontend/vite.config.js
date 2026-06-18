import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/medicine': 'http://localhost:3000',
      '/pharmacy': 'http://localhost:3000',
      '/admin': 'http://localhost:3000'
    }
  }
})