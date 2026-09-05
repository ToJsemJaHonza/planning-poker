import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Explicit local-only test server. The production build never imports this.
export default defineConfig({
  plugins: [react()],
  base: '/planning-poker/',
  resolve: {
    alias: [{ find: /^\.\.\/firebase$/, replacement: fileURLToPath(new URL('../src/test/firebase-mock.js', import.meta.url)) }],
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
