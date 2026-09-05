import { useLayoutEffect, useRef, useState } from 'react';
import { useAnimationFrame } from '../engine/useFrameTicker';
import { pendingEvictions, EVICTION_HIT } from '../events/sessionEviction';
import { computePlayerGridPosition } from '../engine/gridPosition';
import { getGroundY } from '../engine/characterLayout';
import { useMotionMode } from '../engine/useMotionMode';

const clamp = t => Math.max(0, Math.min(1, t));
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Master no longer rerenders the whole room on every stage publication.
// Subscribe to the shared clock only while a takeover is queued or playing.
export function useEvictionClock(events) {
  const [, tick] = useState(0);
  const now = Date.now();
  useAnimationFrame(() => tick(Date.now()), pendingEvictions(events, now).length > 0);
  return now;
}

// Uses the shared MotionRuntime clock, never a second animation loop. Event
// timestamps, queue ordering and quote are all authoritative Firebase data.
export function useSessionEviction({ stage, events, players, now }) {
  const motion = useMotionMode();
  const snapshots = useRef(new Map());
  const pending = pendingEvictions(events, now);
  const active = pending.find(e => e.startedAt <= now);
  useLayoutEffect(() => {
    const width = window.innerWidth;
    const roster = Object.entries(players).filter(([, p]) => p.role !== 'pm' && !p.disconnected)
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    const slot = event => {
      const index = Math.max(0, roster.findIndex(([id]) => id === event.newId));
      return event.role === 'pm' ? { x: width / 2, y: stage.groundY ?? getGroundY() }
        : stage.getSlot?.(event.newId) || computePlayerGridPosition(index, Math.max(1, roster.length), width);
    };
    const controlled = new Set(pending.flatMap(e => [`player-${e.oldId}`, `player-${e.newId}`]));
    for (const char of stage.all()) {
      if (!char.evictionControlled || controlled.has(char.id)) continue;
      if (!players[char.id.slice(7)]) stage.remove(char.id);
      else {
        char.evictionControlled = false;
        char.hidden = false;
        char.interrupt();
        const index = Math.max(0, roster.findIndex(([id]) => `player-${id}` === char.id));
        char.teleport(stage.getSlot?.(char.id.slice(7)) || computePlayerGridPosition(index, Math.max(1, roster.length), width));
      }
    }
    for (const event of pending) {
      const id = `player-${event.oldId}`;
      const ghost = stage.ensure({ id, sprite: 'player', name: event.playerName, position: slot(event), zIndex: 220 });
      if (!ghost.evictionControlled) ghost.interrupt();
      ghost.evictionControlled = true;
      const replacement = stage.get(`player-${event.newId}`);
      if (replacement) {
        replacement.evictionControlled = true;
        replacement.hidden = true;
        replacement.interrupt();
      }
      // A chain of quick replacements is shown one at a time.
      ghost.hidden = event !== (active || pending[0]);
    }
    const pm = stage.get('pm');
    if (!active || !pm) {
      if (pm) pm.hammer = null;
      return;
    }
    const ghost = stage.get(`player-${active.oldId}`);
    if (!snapshots.current.has(active.oldId)) {
      const target = { ...ghost.position };
      target.x = Math.max(90, Math.min(width - 90, target.x));
      snapshots.current.set(active.oldId, { from: { ...pm.position }, target });
    }
    const { from, target } = snapshots.current.get(active.oldId);
    const beside = { x: target.x - 88, y: target.y };
    const elapsed = now - active.startedAt;
    pm.interrupt();
    pm.position = motion === 'reduced' ? beside : elapsed < 2200
      ? mix(from, beside, clamp(elapsed / 2200))
      : elapsed < 4200 ? beside : mix(beside, from, clamp((elapsed - 4200) / 2000));
    pm.facingLeft = false;
    pm.pose = elapsed < 2200 || elapsed >= 4200 ? 'walk' : 'cast';
    pm.walkFrame = Math.floor(elapsed / 180) % 2;
    pm.zIndex = 221;
    pm.bubble = elapsed >= 1600 && elapsed < 4400 ? { text: active.quote, opacity: 1 } : null;
    const windup = clamp((elapsed - 2400) / 550);
    const strike = clamp((elapsed - 2950) / 250);
    pm.hammer = elapsed < 4200 ? {
      angle: motion === 'reduced' ? 25 : 25 - windup * 135 + strike * 205,
    } : null;
    const flight = clamp((elapsed - EVICTION_HIT) / 900);
    ghost.hidden = elapsed >= 4100 || (motion === 'reduced' && elapsed >= EVICTION_HIT);
    ghost.position = motion === 'reduced' ? target : {
      x: target.x + flight * (width + 150 - target.x),
      y: target.y - Math.sin(flight * Math.PI) * 160 - flight * 90,
    };
    ghost.rotation = motion === 'reduced' ? 0 : flight * 650;
    ghost.pose = null;
    ghost.className = '';
  });
  return active;
}
