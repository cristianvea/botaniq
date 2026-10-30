import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// En GitHub Pages la app vive en /<nombre-del-repo>/ → lo pasa el workflow en BASE_PATH
const base = process.env.BASE_PATH || '/';

// Política de seguridad de contenidos: la app solo puede cargar código propio y hablar con estos servicios
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://my-api.plantnet.org https://api.open-meteo.com https://nominatim.openstreetmap.org https://photon.komoot.io https://fonts.googleapis.com https://fonts.gstatic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = () => ({
  name: 'botaniq-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />',
    `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`),
});

export default defineConfig({
  base,
  plugins: [
    react(),
    securityHeaders(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['apple-touch-icon-tulipan.png', 'favicon-tulipan.png'],
      manifest: {
        name: 'BotanIQ',
        short_name: 'BotanIQ',
        description: 'Cuidado botánico inteligente para tu hogar',
        lang: 'es',
        theme_color: '#2a9d8f',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192-tulipan.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512-tulipan.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-tulipan.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg}'] },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
});
