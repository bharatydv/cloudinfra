import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The dev proxy target is configurable so the API can run on another port.
const devApiTarget = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8000'

/**
 * Bakes the site origin into index.html's static social-card tags. Vite's own
 * `%VITE_X%` substitution leaves the token in place when the variable is
 * unset, which would ship a literal "%VITE_SITE_URL%/og-default.png" from a
 * plain `npm run dev`, so this fills it with a dev fallback instead.
 */
function siteUrlInHtml(): Plugin {
  const siteUrl = (process.env.VITE_SITE_URL ?? 'http://localhost:5173').replace(/\/+$/, '')
  return {
    name: 'site-url-in-html',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
  }
}

export default defineConfig({
  plugins: [react(), siteUrlInHtml()],
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
