import { useState, useEffect, useCallback, useRef } from 'react';
import { pixel } from '../room/styles';
import { useFrameTicker } from '../../engine/useFrameTicker';

const SHAME_TEXTS = {
  1: ['👀', 'hmm...', 'tick tock', '...', '💭'],
  2: ['⏰', 'no pressure', "we're waiting", 'take your time...', '🤔', 'ahem'],
  3: ['HURRY!', 'FAST!', 'STRESS', '⚡', '💨', 'GO GO GO', 'COME ON', '🏃'],
  4: ['HURRY UP!', "WE'RE AGING", 'STRESS LVL 99', '🔥', 'VOTE ALREADY',
      'ANY DAY NOW', 'PICK A CARD!', '😤'],
  5: ['MY GRANDMA VOTES FASTER', 'AFK?', 'HELLO??', 'PANIC MODE',
      'DEFCON 1', 'CODE RED', 'SOS', 'MAYDAY', '⚠️⚠️⚠️',
      'EARTH TO {name}', '🚨', 'CRITICAL ERROR: NO VOTE DETECTED'],
};

const SHAME_TEXT_CONFIG = {
  1: { interval: 4000, size: '0.6rem', opacity: 0.3, color: '#b8922e', duration: 2500 },
  2: { interval: 3000, size: '0.8rem', opacity: 0.5, color: '#d4a853', duration: 3000 },
  3: { interval: 1500, size: '1.2rem', opacity: 0.7, color: '#e67e22', duration: 2500 },
  4: { interval: 800,  size: '1.5rem', opacity: 0.8, color: '#e74c3c', duration: 2000 },
  5: { interval: 400,  size: '2rem',   opacity: 0.9, color: '#e74c3c', duration: 1500 },
};

let textIdCounter = 0;

export default function ShameText({ stage, holdoutName, isHoldout }) {
  const [texts, setTexts] = useState([]);
  const active = stage >= 1 && isHoldout;
  const config = active ? SHAME_TEXT_CONFIG[stage] : null;

  // Reset text pool when stage drops or holdout changes.
  useEffect(() => {
    if (!active) setTexts([]);
  }, [active, stage, holdoutName]);

  const spawnRef = useRef(null);
  const spawn = useCallback(() => {
    if (!active) return;
    const cfg = SHAME_TEXT_CONFIG[stage];
    const pool = SHAME_TEXTS[stage];
    const raw = pool[Math.floor(Math.random() * pool.length)];
    const text = raw.replace('{name}', holdoutName || '???');
    const rot = (Math.random() - 0.5) * (stage >= 5 ? 60 : stage >= 3 ? 30 : 10);
    const id = textIdCounter++;

    setTexts(prev => {
      const max = stage >= 4 ? 15 : 8;
      const base = prev.length >= max ? prev.slice(1) : prev;
      return [...base, {
        id, text, rot,
        left: 10 + Math.random() * 80,
        top: 5 + Math.random() * 60,
        size: cfg.size,
        opacity: Math.min(cfg.opacity, 0.35),
        color: stage >= 5 && Math.random() > 0.5 ? '#fff' : cfg.color,
        duration: cfg.duration,
      }];
    });

    setTimeout(() => {
      setTexts(prev => prev.filter(t => t.id !== id));
    }, cfg.duration + 100);
  }, [active, stage, holdoutName]);

  spawnRef.current = spawn;

  // Fire one spawn synchronously on activation so a text appears before
  // the first MotionRuntime tick (some test/headless paths never flush rAF).
  useEffect(() => {
    if (active) spawnRef.current?.();
  }, [active, stage, holdoutName]);

  useFrameTicker(config?.interval ?? 0, spawn, active);

  if (texts.length === 0) return null;

  return (
    <div style={containerStyle}>
      {texts.map(t => (
        <span
          key={t.id}
          style={{
            position: 'absolute',
            left: `${t.left}%`,
            top: `${t.top}%`,
            fontSize: t.size,
            fontFamily: pixel,
            color: t.color,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textShadow: '0 0 2px rgba(0,0,0,0.6)',
            '--rot': `${t.rot}deg`,
            '--max-opacity': `${t.opacity}`,
            animation: `shameTextFloat ${t.duration}ms ease-out forwards`,
          }}
        >
          {t.text}
        </span>
      ))}
    </div>
  );
}

const containerStyle = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 40,
  overflow: 'hidden',
};
