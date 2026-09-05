// Explicit opt-in integration check against a configured Firebase database.
// Runs the real useRoom hook, not the in-memory adapter. Creates and removes
// only uniquely claimed diagnostic rooms; never changes database rules.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, ref, get, onValue, onDisconnect, runTransaction, remove, goOffline, goOnline } from 'firebase/database';

if (!process.env.VITE_FIREBASE_DATABASE_URL) throw new Error('Set VITE_FIREBASE_DATABASE_URL and the app Firebase environment variables first.');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { renderHook, waitFor, cleanup } = await import('@testing-library/react');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { useRoom, generateRoomCode } = await server.ssrLoadModule('/src/hooks/useRoom.js');
const { db } = await server.ssrLoadModule('/src/firebase.js');
const observerApp = initializeApp({ databaseURL: process.env.VITE_FIREBASE_DATABASE_URL }, `observer-${randomUUID()}`);
const observerDb = getDatabase(observerApp);
const timer = setTimeout(() => { console.error('Live connection check timed out'); process.exit(2); }, 60000);
const ownedRooms = [];
const unsubscribes = [];
const ids = ['qa-creator', 'qa-voter'];

try {
  for (const role of ['pm', 'player']) {
    const code = generateRoomCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
    const marker = `Connection smoke test ${randomUUID()}`;
    const roomRef = ref(db, `rooms/${code}`);
    const claim = await runTransaction(roomRef, current => current == null
      ? { meta: { task: marker, phase: 'voting', createdAt: Date.now() } }
      : undefined);
    assert.equal(claim.committed, true, 'Refusing to reuse an existing room');
    ownedRooms.push({ code, marker });
    // Reproduce the old first-join operation under the actual deployed rules.
    await assert.rejects(onDisconnect(ref(db, `rooms/${code}/players/qa-creator`)).update({ disconnected: true }), /PERMISSION_DENIED/);
    console.log(`${role}: old registration without a name was rejected as expected`);

    let observed = {};
    unsubscribes.push(onValue(ref(observerDb, `rooms/${code}/players`), snap => { observed = snap.val() || {}; }));
    const creator = renderHook(() => useRoom(code, ids[0], 'QA Creator', role));
    await waitFor(() => assert.equal(creator.result.current.connected, true), { timeout: 8000 });
    const voter = renderHook(() => useRoom(code, ids[1], 'QA Voter', 'player'));
    await waitFor(() => assert.equal(voter.result.current.connected, true), { timeout: 8000 });
    voter.result.current.castVote('13');
    await waitFor(() => assert.equal(observed[ids[1]]?.vote, '13'), { timeout: 8000 });
    console.log(`${role}: real hook joined both participants and server confirmed the vote`);

    for (let cycle = 0; cycle < 2; cycle++) {
      goOffline(db);
      await waitFor(() => assert.ok(ids.every(id => observed[id]?.disconnected === true)), { timeout: 8000 });
      goOnline(db);
      await waitFor(() => assert.ok(creator.result.current.connected && voter.result.current.connected), { timeout: 8000 });
      await waitFor(() => assert.ok(ids.every(id => observed[id]?.disconnected === false)), { timeout: 8000 });
      assert.equal(observed[ids[1]].vote, '13');
      assert.equal(observed[ids[0]].role, role);
    }
    console.log(`${role}: two real disconnect/reconnect cycles preserved the vote and role`);
    cleanup();
  }
} finally {
  cleanup();
  unsubscribes.forEach(unsubscribe => unsubscribe());
  goOnline(db);
  for (const { code, marker } of ownedRooms) {
    await Promise.all(ids.map(id => onDisconnect(ref(db, `rooms/${code}/players/${id}`)).cancel()));
    const current = (await get(ref(db, `rooms/${code}`))).val();
    if (current?.meta?.task === marker && Object.keys(current.players || {}).every(id => ids.includes(id))) {
      await remove(ref(db, `rooms/${code}`));
      console.log(`Removed owned diagnostic room ${code}`);
    } else {
      throw new Error(`Refusing cleanup: diagnostic room ${code} changed ownership`);
    }
  }
  goOffline(db);
  goOffline(observerDb);
  await deleteApp(observerApp);
  await server.close();
  dom.window.close();
  clearTimeout(timer);
}
