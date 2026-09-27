/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Production (Vercel production deployment) vs everything else (previews on staging, local dev):
// distinct app name and accent colour so the two installed PWAs can't be confused.
const isProd = process.env.VERCEL_ENV === 'production'
const app = isProd
  ? { env: 'prod', name: 'TKF Programming', shortName: 'TKF', themeColor: '#09090b' }
  : { env: 'staging', name: 'TKF Staging', shortName: 'TKF Staging', themeColor: '#7f1d1d' }

export default defineConfig({
  define: { 'import.meta.env.VITE_APP_NAME': JSON.stringify(app.name) },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'app-env-html',
      transformIndexHtml: (html) =>
        html
          .replace('<html lang="fr">', `<html lang="fr" data-env="${app.env}">`)
          .replaceAll('%APP_NAME%', app.name)
          .replaceAll('%APP_SHORT_NAME%', app.shortName)
          .replaceAll('%THEME_COLOR%', app.themeColor),
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'tkf-logo.jpg'],
      manifest: {
        name: app.name,
        short_name: app.shortName,
        description: 'Programmation CrossFit entre amis',
        lang: 'fr',
        theme_color: app.themeColor,
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallback: '/index.html' },
    }),
  ],
  test: { environment: 'node' },
})
