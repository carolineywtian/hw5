import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The FastAPI backend from Problem 7 (backend/main.py) runs at http://localhost:8000.
// The dev server proxies /api there, so the browser only talks to one origin.
// Set BACKEND_URL to point the proxy somewhere else (e.g. a test backend).
const backend = process.env.BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
    },
  },
})
