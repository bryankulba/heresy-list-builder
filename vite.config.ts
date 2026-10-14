/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/heresy-list-builder/' : '/',
  plugins: [
    react(),
    // Installable and offline: the service worker caches the app and every
    // army's data files, so lists can be built at the table without signal
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Heresy List Builder',
        short_name: 'Heresy Lists',
        description: 'A visual army list builder for Horus Heresy 3rd Edition',
        theme_color: '#161616',
        background_color: '#161616',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        // The main bundle is ~2.5MB (BSData rules); cache it all
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: ['node_modules'],
        silenceDeprecations: ['import'],
      },
    },
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    fs: {
      // Allow importing from data/parsed/ which is outside src/
      allow: ['..'],
    },
  },
});
