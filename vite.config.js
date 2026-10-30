import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import fs from 'node:fs';
import path from 'node:path';

// En GitHub Pages la app vive en /<nombre-del-repo>/ (o en / con dominio propio) → lo pasa el workflow en BASE_PATH
const base = process.env.BASE_PATH || '/';
// Dirección pública completa (para la vista previa al compartir por WhatsApp), terminada en /
const SITE = (process.env.VITE_SITE_URL || '').replace(/\/?$/, '/');

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

// Vista previa al compartir el enlace (WhatsApp necesita direcciones completas)
const sharePreview = () => ({
  name: 'botaniq-og',
  apply: 'build',
  transformIndexHtml: (html) => (SITE === '/' ? html : html.replace('<title>BotanIQ</title>', `<title>BotanIQ</title>
    <meta name="description" content="Cuidado botánico inteligente para tu hogar: te avisa de cuándo regar cada planta según el tiempo de tu zona." />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BotanIQ" />
    <meta property="og:title" content="BotanIQ · Cuidado botánico inteligente para tu hogar" />
    <meta property="og:description" content="Te avisa de cuándo regar cada planta según el tiempo de tu zona." />
    <meta property="og:url" content="${SITE}" />
    <meta property="og:image" content="${SITE}og-botaniq.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />`)),
  // La página de instalación es estática: le ponemos la dirección pública
  closeBundle() {
    const f = path.resolve('dist/instalar/index.html');
    if (fs.existsSync(f)) {
      let html = fs.readFileSync(f, 'utf8');
      html = SITE === '/' ? html.replace(/\s*<meta property="og:(url|image)"[^>]*>/g, '') : html.replaceAll('%SITE_URL%', SITE);
      fs.writeFileSync(f, html);
    }
  },
});

export default defineConfig({
  base,
  plugins: [
    react(),
    securityHeaders(),
    sharePreview(),
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
