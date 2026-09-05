// Local-only cross-tab QA backend. Web Locks serialize transactions against
// one localStorage fixture; it never connects to the production database.
import * as memory from '../src/test/firebase-mock';
const key = 'poker-session-qa-database';
const hydrate = () => {
  const saved = localStorage.getItem(key);
  if (saved && saved !== JSON.stringify(memory.__mock.getStore())) memory.__mock.setStore(JSON.parse(saved));
};
hydrate();
window.addEventListener('storage', e => { if (e.key === key) hydrate(); });
const write = fn => navigator.locks.request(key, async () => {
  hydrate();
  const result = await fn();
  localStorage.setItem(key, JSON.stringify(memory.__mock.getStore()));
  return result;
});
export const { db, ref, onValue, onDisconnect, push, serverTimestamp } = memory;
export const get = (...args) => { hydrate(); return memory.get(...args); };
export const set = (...args) => write(() => memory.set(...args));
export const update = (...args) => write(() => memory.update(...args));
export const remove = (...args) => write(() => memory.remove(...args));
export const runTransaction = (...args) => write(() => memory.runTransaction(...args));
