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
    // Longer than the ceremony grace window so integration tests that
    // await ceremony firing don't race their own grace. The PM-ceremony
    // trigger in useRoom waits CEREMONY_GRACE_MS (15 s) before firing;
    // individual waitFors use CEREMONY_GRACE_MS + 3 s, and the test
    // itself needs to outlast both plus Firebase round-trip.
    testTimeout: 25000,
  },
})
