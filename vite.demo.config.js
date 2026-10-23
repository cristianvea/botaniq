// Compila BotanIQ en modo demo: sin servidores, con datos de ejemplo, en una sola página HTML.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const swap = { 'supabase.js': 'supabase.js', 'plantnet.js': 'plantnet.js', 'weather.js': 'weather.js', 'diagnose.js': 'diagnose.js', 'push.js': 'push.js', 'assistant.js': 'assistant.js' };
const libDir = path.resolve('src/lib');
const demoDir = path.resolve('src/demo');

function demoSwap() {
  return {
    name: 'botaniq-demo-swap',
    enforce: 'pre',
    async resolveId(source, importer, opts) {
      if (!importer || importer.startsWith(demoDir)) return null;
      const r = await this.resolve(source, importer, { ...opts, skipSelf: true });
      if (!r) return null;
      const base = path.basename(r.id);
      if (path.dirname(r.id) === libDir && swap[base]) return path.join(demoDir, swap[base]);
      return null;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [demoSwap(), react()],
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
  build: {
    outDir: 'dist-demo',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
