import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// DRTC frontend build config
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['drtc.svg'],
      manifest: {
        name: 'DRTC — Distributed Real-Time Command & Control',
        short_name: 'DRTC',
        description: 'Tactical real-time global situational-awareness console.',
        theme_color: '#05070a',
        background_color: '#05070a',
        display: 'standalone',
        icons: [
          { src: 'drtc.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        // Don't precache the multi-MB three.js chunk; cache it at runtime instead.
        maximumFileSizeToCacheInBytes: 3_500_000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'drtc-basemap',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 3600 },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'react-globe.gl'],
          maplibre: ['maplibre-gl'],
        },
      },
    },
  },
})
