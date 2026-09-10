import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev proxy target is configurable so the API can run on another port.
const devApiTarget = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev-only convenience so the browser and API share an origin.
      '/api': { target: devApiTarget, changeOrigin: true },
      '/sitemap.xml': { target: devApiTarget, changeOrigin: true },
      '/robots.txt': { target: devApiTarget, changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split vendor code so the marketing pages do not ship the whole app.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
        },
      },
    },
  },
})
