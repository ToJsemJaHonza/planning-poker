/**
 * Shallow equality comparison optimized for 60fps rendering paths.
 *
 * Hand-rolled to avoid JSON.stringify overhead. Handles one level of
 * nesting for arrays and objects (e.g. reelStates, positions) which is
 * sufficient for the phase state shape.
 */

function shallowEqualChild(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i++) {
    const k = ak[i];
    if (!(k in b)) return false;
    const av = a[k];
    const bv = b[k];
    if (av === bv) continue;
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length) return false;
      for (let j = 0; j < av.length; j++) {
        if (!shallowEqualChild(av[j], bv[j])) return false;
      }
      continue;
    }
    if (typeof av === 'object' && typeof bv === 'object' && av && bv) {
      if (!shallowEqualChild(av, bv)) return false;
      continue;
    }
    return false;
  }
  return true;
}
