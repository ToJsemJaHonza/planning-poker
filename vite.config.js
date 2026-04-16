import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/planning-poker/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    // 15 s instead of the default 5 s — the PM-ceremony trigger has a
    // 5 s leader-reconnection grace window, and integration tests that
    // await ceremony firing would otherwise race their own grace.
    testTimeout: 15000,
  },
})
