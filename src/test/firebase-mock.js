// Minimal in-memory Firebase Realtime Database mock for tests.
// Covers: set / get / update / onValue / onDisconnect / push / serverTimestamp.
// Parent listeners are notified when a child changes (and vice versa).

let store = {};
const listeners = new Map(); // normalized path → Set<callback>
const disconnectQueue = new Map(); // normalized path → action

// Seed the SDK's `.info/connected` system path. Real Firebase reports
// `true` once the WebSocket is established; tests get that default for
// free, and can flip it with `__mock.setConnectedState(false)` to
// simulate a drop.
const INFO_CONNECTED_DEFAULT = true;

function _splitPath(path) {
  return String(path).split('/').filter(Boolean);
}

function _normPath(path) {
  const parts = _splitPath(path);
  return '/' + parts.join('/');
}

function _getAt(path) {
  const parts = _splitPath(path);
  let node = store;
  for (const p of parts) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[p];
  }
  return node;
}

function _setAt(path, value) {
  const parts = _splitPath(path);
  if (parts.length === 0) {
    store = value == null ? {} : _deepClone(value);
    return;
  }
  let node = store;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (node[p] == null || typeof node[p] !== 'object') node[p] = {};
    node = node[p];
  }
  const last = parts[parts.length - 1];
  if (value == null) {
    delete node[last];
  } else {
    node[last] = _deepClone(value);
  }
}

function _deepClone(v) {
  if (v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(_deepClone);
  const o = {};
  for (const k of Object.keys(v)) o[k] = _deepClone(v[k]);
  return o;
}

function _fireListener(normPath) {
  const set = listeners.get(normPath);
  if (!set || set.size === 0) return;
  const val = _getAt(normPath);
  const snap = {
    val: () => _deepClone(val ?? null),
    exists: () => val !== undefined,
  };
  // Copy to a new array first in case callbacks mutate the set
  Array.from(set).forEach(cb => cb(snap));
}

function _notify(changedPath) {
  const norm = _normPath(changedPath);
  const parts = _splitPath(norm);

  // 1. Every ancestor (including exact path and root '/')
  for (let i = 0; i <= parts.length; i++) {
    const anc = '/' + parts.slice(0, i).join('/');
    const cleanAnc = anc === '/' ? '/' : anc.replace(/\/+$/, '');
    _fireListener(cleanAnc);
  }

  // 2. Every descendant listener (e.g. a listener on /rooms/X/players/Alice
  //    when /rooms/X is replaced wholesale)
  for (const listenerPath of listeners.keys()) {
    if (listenerPath === norm) continue; // already fired
    if (listenerPath.startsWith(norm === '/' ? '/' : norm + '/')) {
      _fireListener(listenerPath);
    }
  }
}

export const db = { __mock: true };

export function ref(_db, path = '') {
  return { __ref: true, path: _normPath(path) };
}

export async function set(r, value) {
  _setAt(r.path, value);
  _notify(r.path);
}

export async function get(r) {
  const val = _getAt(r.path);
  return { val: () => _deepClone(val ?? null), exists: () => val !== undefined };
}

export async function update(r, updates) {
  // update(ref, { 'a/b': 1, 'c': 2 })
  // If ref is '/', keys may contain slashes for a multi-path update.
  const changedPaths = [];
  for (const [k, v] of Object.entries(updates)) {
    let targetPath;
    if (k.startsWith('/')) {
      targetPath = _normPath(k);
    } else if (k.includes('/') && r.path === '/') {
      targetPath = _normPath('/' + k);
    } else {
      targetPath = _normPath(r.path + '/' + k);
    }
    _setAt(targetPath, v);
    changedPaths.push(targetPath);
  }
  changedPaths.forEach(_notify);
}

export async function remove(r) {
  _setAt(r.path, undefined);
  _notify(r.path);
}

// Mirror the shape of Firebase's runTransaction enough for useRoom tests.
// The real API hands the updater a snapshot-style value and commits the
// returned value atomically; returning `undefined` aborts. Our in-memory
// store is synchronous so there's no retry/contention to simulate.
export async function runTransaction(r, updateFn) {
  const current = _getAt(r.path);
  const next = updateFn(_deepClone(current));
  if (next === undefined) {
    return {
      committed: false,
      snapshot: {
        val: () => _deepClone(current ?? null),
        exists: () => current !== undefined,
      },
    };
  }
  _setAt(r.path, next);
  _notify(r.path);
  return {
    committed: true,
    snapshot: {
      val: () => _deepClone(next ?? null),
      exists: () => next !== undefined,
    },
  };
}

export function onValue(r, cb) {
  const key = _normPath(r.path);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(cb);
  // Fire initial value synchronously like the real SDK
  const val = _getAt(r.path);
  cb({ val: () => _deepClone(val ?? null), exists: () => val !== undefined });
  return () => {
    listeners.get(key)?.delete(cb);
  };
}

export function onDisconnect(r) {
  const p = _normPath(r.path);
  return {
    remove: async () => { disconnectQueue.set(p, 'remove'); },
    set: async (v) => { disconnectQueue.set(p, { type: 'set', value: v }); },
    update: async (v) => { disconnectQueue.set(p, { type: 'update', value: v }); },
    cancel: async () => { disconnectQueue.delete(p); },
  };
}

export function push(r) {
  const id = 'push_' + Math.random().toString(36).slice(2, 10);
  return { __ref: true, path: r.path + '/' + id, key: id };
}

export function serverTimestamp() {
  return Date.now();
}

// Seed `.info/connected` at module-load time too — tests that don't call
// __mock.reset() (e.g. simple component tests via setStore) still get the
// SDK-realistic default.
_setAt('/.info/connected', INFO_CONNECTED_DEFAULT);

// Test helpers
export const __mock = {
  reset() {
    store = {};
    listeners.clear();
    disconnectQueue.clear();
    // Mirror the SDK's `.info/connected` system path. The real client
    // exposes this as `true` once the WebSocket is up; tests that don't
    // care about connectivity still expect the room to render.
    _setAt('/.info/connected', INFO_CONNECTED_DEFAULT);
  },
  // Flip the simulated `.info/connected` state. Use to exercise reconnect UX.
  setConnectedState(value) {
    _setAt('/.info/connected', !!value);
    _notify('/.info/connected');
  },
  getStore: () => _deepClone(store),
  setStore(s) {
    store = _deepClone(s);
    // Notify every registered listener so subscribers see the new world
    for (const key of Array.from(listeners.keys())) _fireListener(key);
  },
  // Remove a player entry by its Firebase key. After the session-ID
  // refactor the key is the player's session ID, but tests that use the
  // display name as the ID (simple single-name fixtures) still work.
  removePlayer(roomCode, playerKey) {
    const path = `/rooms/${roomCode}/players/${playerKey}`;
    _setAt(path, undefined);
    _notify(path);
  },
  triggerDisconnect(path) {
    const norm = _normPath(path);
    const action = disconnectQueue.get(norm);
    if (action === 'remove') {
      _setAt(norm, undefined);
      _notify(norm);
    } else if (action?.type === 'set') {
      _setAt(norm, action.value);
      _notify(norm);
    } else if (action?.type === 'update') {
      const current = _getAt(norm);
      const merged = { ...(current || {}), ...action.value };
      _setAt(norm, merged);
      _notify(norm);
    }
    disconnectQueue.delete(norm);
  },
  triggerDisconnectAll() {
    for (const [path, action] of Array.from(disconnectQueue.entries())) {
      if (action === 'remove') {
        _setAt(path, undefined);
      } else if (action?.type === 'set') {
        _setAt(path, action.value);
      } else if (action?.type === 'update') {
        const current = _getAt(path);
        _setAt(path, { ...(current || {}), ...action.value });
      }
      _notify(path);
    }
    disconnectQueue.clear();
  },
};
