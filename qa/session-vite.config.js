import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: [{ find: /^\.\.\/firebase(?:\.js)?$/, replacement: fileURLToPath(new URL('./session-firebase.js', import.meta.url)) }] },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
