// Persistence is optional when private windows or embedded browsers deny it.
export function readPreference(key, fallback = null) {
  try { return window.localStorage.getItem(key) || fallback; } catch { return fallback; }
}
export function savePreference(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* Keep the current in-memory session usable. */ }
}
