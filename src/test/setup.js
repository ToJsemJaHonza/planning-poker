import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Globally replace src/firebase.js with the in-memory mock so NO test ever
// tries to call the real Firebase SDK. Without this, any component that
// transitively imports `../firebase` (directly or via useRoom / Landing /
// Room) would crash at import time in CI because VITE_FIREBASE_* env vars
// aren't defined on the test job. Tests that need to seed state can still
// import `./firebase-mock.js` directly (same module, same exports).
vi.mock('../firebase', async () => await import('./firebase-mock.js'));
vi.mock('../firebase.js', async () => await import('./firebase-mock.js'));
vi.mock('../../firebase', async () => await import('./firebase-mock.js'));
vi.mock('../../firebase.js', async () => await import('./firebase-mock.js'));

afterEach(() => {
  cleanup();
});

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
