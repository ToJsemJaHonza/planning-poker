const newId = () => crypto.randomUUID();

// One connection per document, including duplicated tabs (whose sessionStorage
// browsers may copy). Never let an old socket's onDisconnect touch a new slot.
let documentIdentity;
export function getSessionIdentity() {
  if (documentIdentity) return documentIdentity;
  const playerId = newId();
  let deviceId = null;
  let previousPlayerId = null;
  try {
    deviceId = localStorage.getItem('poker-device-id') || newId();
    localStorage.setItem('poker-device-id', deviceId);
    if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
      previousPlayerId = sessionStorage.getItem('poker-player-id');
    }
    sessionStorage.setItem('poker-player-id', playerId);
  } catch { /* Storage-disabled clients retain an independent connection. */ }
  documentIdentity = { playerId, deviceId, previousPlayerId };
  return documentIdentity;
}
