import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: process.env.VITE_BACKEND_URL || 'http://localhost:8000', changeOrigin: true },
      '/static': { target: process.env.VITE_BACKEND_URL || 'http://localhost:8000', changeOrigin: true },
      '/uploads': { target: process.env.VITE_BACKEND_URL || 'http://localhost:8000', changeOrigin: true },
    },
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
  }
})
