/**
 * activeOverlays — registry-driven overlay derivation.
 *
 * Regression coverage for the okta + specialRound migration: both used
 * to read from dedicated meta/oktaEvent and meta/specialRound boolean
 * paths. After the migration they read from the unified syncedEvent
 * channel just like chicken. These tests would have failed before the
 * migration shipped because activeOverlays still required oktaEvent /
 * specialRound props.
 */
import { describe, it, expect } from 'vitest';
import { activeOverlays, ENTRANCE_EVENTS, CINEMATIC_CATEGORY, CINEMATIC_SOURCE } from './entranceEvents';

describe('activeOverlays — syncedEvent-only contract', () => {
  it('returns nothing when no syncedEvent is active', () => {
    expect(activeOverlays({ syncedEvent: null })).toEqual([]);
  });

  it('matches chicken on syncedEvent.type === "chicken"', () => {
    const out = activeOverlays({ syncedEvent: { type: 'chicken', startedAt: 1, expiresAt: 9999 } });
    expect(out).toHaveLength(1);
    expect(out[0].event.type).toBe('chicken');
    expect(out[0].payload.type).toBe('chicken');
  });

  it('matches okta on syncedEvent.type === "okta" (post-migration)', () => {
    const out = activeOverlays({ syncedEvent: { type: 'okta', startedAt: 1, expiresAt: 9999 } });
    expect(out).toHaveLength(1);
    expect(out[0].event.type).toBe('okta');
  });

  it('matches specialRound on syncedEvent.type === "specialRound" (post-migration)', () => {
    const out = activeOverlays({ syncedEvent: { type: 'specialRound', startedAt: 1, expiresAt: 9999 } });
    expect(out).toHaveLength(1);
    expect(out[0].event.type).toBe('specialRound');
  });

  it('does NOT match an overlay just because a legacy `oktaEvent` flag is true', () => {
    // Legacy callers passing a stray `oktaEvent: true` should be a no-op now —
    // the only signal that activates the okta overlay is syncedEvent.type.
    expect(activeOverlays({ syncedEvent: null, oktaEvent: true })).toEqual([]);
    expect(activeOverlays({ syncedEvent: null, specialRound: true })).toEqual([]);
  });
});

describe('CINEMATIC_SOURCE — single source remains', () => {
  it('only SYNCED_EVENT survives the migration', () => {
    expect(CINEMATIC_SOURCE).toEqual({ SYNCED_EVENT: 'syncedEvent' });
    expect(CINEMATIC_SOURCE.OKTA_EVENT).toBeUndefined();
    expect(CINEMATIC_SOURCE.SPECIAL_ROUND).toBeUndefined();
  });

  it('every OVERLAY entry uses CINEMATIC_SOURCE.SYNCED_EVENT', () => {
    const overlays = ENTRANCE_EVENTS.filter(
      (e) => e.category === CINEMATIC_CATEGORY.OVERLAY,
    );
    expect(overlays.length).toBeGreaterThan(0);
    for (const entry of overlays) {
      expect(entry.source).toBe(CINEMATIC_SOURCE.SYNCED_EVENT);
    }
  });
});
