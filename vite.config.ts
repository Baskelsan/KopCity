import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import texts from './src/data/texts.fr.json' with { type: 'json' };
import pkg from './package.json' with { type: 'json' };

// Nom du dépôt GitHub : l'app est servie sous https://<user>.github.io/KopCity/
const base = '/KopCity/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    preact(),
    {
      // Les textes de index.html viennent de texts.fr.json
      name: 'kop-city-html-texts',
      transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', texts.app.name),
    },
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: texts.app.name,
        short_name: texts.app.shortName,
        description: texts.app.description,
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1410',
        theme_color: '#0b1410',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
