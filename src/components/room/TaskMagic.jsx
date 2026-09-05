import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAnimationFrame } from '../../engine/useFrameTicker';
import { useMotionMode } from '../../engine/useMotionMode';
import { TaskMagicContext, useTaskMagic } from './taskMagicContext';

const DURATION = 1800;
const noise = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Sample a tiny, local pixel-card texture. No screenshot service, external
// assets, or thousands of animated DOM nodes; at most 1200 grains per burst.
function texture(rect, title) {
  const card = document.createElement('canvas');
  card.width = Math.max(1, Math.min(440, Math.round(rect.width)));
  card.height = Math.max(1, Math.min(100, Math.round(rect.height)));
  const ctx = card.getContext('2d');
  if (!ctx) return { card, grains: [] };
  ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, card.width, card.height);
  ctx.strokeStyle = '#d4a853'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, card.width - 4, card.height - 4);
  ctx.fillStyle = '#2a2a3a'; ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText(title || 'Task', 10, card.height / 2 + 4, card.width - 20);
  const pixels = ctx.getImageData(0, 0, card.width, card.height).data;
  const step = Math.max(3, Math.ceil(Math.sqrt(card.width * card.height / 1200)));
  const grains = [];
  for (let y = 0; y < card.height; y += step) for (let x = 0; x < card.width; x += step) {
    const i = (y * card.width + x) * 4;
    grains.push({ x, y, size: step, color: `rgb(${pixels[i]},${pixels[i + 1]},${pixels[i + 2]})`, seed: grains.length + 1 });
  }
  return { card, grains };
}

export default function TaskMagic({ taskList, children }) {
  const mode = useMotionMode();
  const [effects, setEffects] = useState([]);
  const canvasRef = useRef(null);
  const lastSignal = useRef(null);
  const rects = useRef(new Map());
  const burst = useCallback((type, rect, title = 'Task', startedAt = Date.now()) => {
    if (!rect || rect.width <= 0 || Date.now() - startedAt >= DURATION) return;
    const bounds = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    const effect = { type, rect: bounds, startedAt, ...texture(bounds, title) };
    setEffects(old => [...old.slice(-2), effect]);
  }, []);

  useLayoutEffect(() => {
    const signal = taskList?.effect;
    if (signal && signal.id !== lastSignal.current) {
      lastSignal.current = signal.id;
      const fallback = document.querySelector('[data-task-bar]')?.getBoundingClientRect();
      // A multi-row save is one snap, with bounded representative fragments.
      for (const item of (signal.removed || []).slice(0, 2)) {
        burst('remove', rects.current.get(item.id) || fallback, item.title, signal.startedAt);
      }
      for (const id of (signal.addedIds || []).slice(0, 2)) {
        const chip = [...document.querySelectorAll('[data-task-chip-id]')].find(el => el.dataset.taskChipId === id);
        burst('add', chip?.getBoundingClientRect() || fallback, taskList.items?.[id]?.title, signal.startedAt);
      }
    }
    const next = new Map();
    for (const el of document.querySelectorAll('[data-task-chip-id]')) next.set(el.dataset.taskChipId, el.getBoundingClientRect());
    rects.current = next;
  }, [taskList, burst]);

  useEffect(() => {
    const refresh = () => {
      for (const el of document.querySelectorAll('[data-task-chip-id]')) rects.current.set(el.dataset.taskChipId, el.getBoundingClientRect());
    };
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    return () => { window.removeEventListener('scroll', refresh, true); window.removeEventListener('resize', refresh); };
  }, []);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const now = Date.now();
    const duration = mode === 'reduced' ? 180 : DURATION;
    const remaining = effects.filter(effect => now - effect.startedAt < duration);
    if (remaining.length !== effects.length) setEffects(remaining);
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = window.innerWidth, h = window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    for (const effect of remaining) {
      const t = Math.max(0, (now - effect.startedAt) / duration);
      const { rect, card, grains, type } = effect;
      if (mode === 'reduced') {
        ctx.globalAlpha = (1 - t) * 0.5; ctx.drawImage(card, rect.x, rect.y, rect.width, rect.height); continue;
      }
      if (type === 'add') {
        const p = Math.min(1, t * 2);
        const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = '#a66bff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1, rect.width * p * 0.6), 8 + p * 32, 0, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 80; i++) {
          const angle = noise(i) * Math.PI * 2;
          const radius = (1 - p) * (40 + noise(i + 81) * 90);
          ctx.fillStyle = ['#a66bff', '#4bdddf', '#ffd76a'][i % 3];
          const x = rect.x + noise(i + 200) * rect.width + Math.cos(angle) * radius;
          const y = rect.y + noise(i + 300) * rect.height + Math.sin(angle) * radius;
          ctx.fillRect(x, y, 2 + noise(i + 400) * 3, 3);
        }
      } else {
        for (const grain of grains) {
          const delay = grain.x / card.width * 0.27;
          const p = Math.max(0, Math.min(1, (t - delay - 0.08) / 0.65));
          const wind = p * p * (140 + noise(grain.seed) * 220);
          const lift = -p * (25 + noise(grain.seed + 100) * 100) + Math.sin(p * 8 + grain.seed) * p * 15;
          ctx.globalAlpha = 1 - p;
          ctx.fillStyle = grain.color;
          ctx.fillRect(rect.x + grain.x * rect.width / card.width + wind, rect.y + grain.y * rect.height / card.height + lift, grain.size * (1 - p * 0.6), grain.size * (1 - p * 0.6));
        }
      }
    }
    ctx.globalAlpha = 1;
  }, effects.length > 0);

  const snapping = effects.some(effect => effect.type === 'remove');
  const context = useMemo(() => ({ burst, snapping }), [burst, snapping]);
  return <TaskMagicContext.Provider value={context}>
    {children}
    {effects.length > 0 && <canvas ref={canvasRef} data-task-magic={snapping ? 'remove' : 'add'} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', pointerEvents: 'none', zIndex: 250 }} />}
  </TaskMagicContext.Provider>;
}

export function InfinityGauntlet() {
  const { snapping } = useTaskMagic();
  if (!snapping) return null;
  return <svg className="task-gauntlet-snap" data-infinity-gauntlet aria-hidden="true" width="36" height="44" viewBox="0 0 18 22" shapeRendering="crispEdges" style={{ position: 'absolute', left: 33, top: 13, filter: 'drop-shadow(0 0 6px #b46dff)' }}>
    <path fill="#7d4b22" d="M4 21V12H2V7H5V2H8V0H11V3H14V6H17V14H14V21Z" />
    <path fill="#eebd46" d="M5 20V11H3V8H6V3H8V7H10V2H12V8H15V13H12V20Z" />
    <path fill="#ffe49b" d="M6 13H12V17H6ZM6 4H7V9H6ZM10 3H11V8H10Z" />
    {['#a15bff', '#399dff', '#ef4d59', '#ff923c', '#5dea91', '#ffe35b'].map((color, i) => <rect key={color} x={4 + (i % 3) * 4} y={8 + Math.floor(i / 3) * 4} width="2" height="2" fill={color} />)}
  </svg>;
}
