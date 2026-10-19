import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Origem canônica do pacote: http://localhost:4173 (runner). O dev server usa 5173 para
// não misturar o OPFS de desenvolvimento com o save do jogador.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export default defineConfig({
  base: './',
  plugins: [preact()],
  server: { host: 'localhost', port: 5173, strictPort: true, headers: isolationHeaders },
  preview: { host: 'localhost', port: 4173, strictPort: true, headers: isolationHeaders },
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __DEV_LAB__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
});
