import { useState, useEffect, useRef } from 'react';
import { pixel } from '../room/styles';

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
  const intervalRef = useRef(null);

  useEffect(() => {
    if (stage < 1 || !isHoldout) {
      setTexts([]);
      return;
    }

    const config = SHAME_TEXT_CONFIG[stage];
    const pool = SHAME_TEXTS[stage];

    const spawn = () => {
      const raw = pool[Math.floor(Math.random() * pool.length)];
      const text = raw.replace('{name}', holdoutName || '???');
      const rot = (Math.random() - 0.5) * (stage >= 5 ? 60 : stage >= 3 ? 30 : 10);
      const id = textIdCounter++;

      setTexts(prev => {
        // Cap active texts to prevent DOM overload
        const max = stage >= 4 ? 15 : 8;
        const base = prev.length >= max ? prev.slice(1) : prev;
        return [...base, {
          id, text, rot,
          left: 10 + Math.random() * 80,
          // Confine to upper 70% of viewport to keep card picker clear
          top: 5 + Math.random() * 60,
          size: config.size,
          opacity: Math.min(config.opacity, 0.35),
          color: stage >= 5 && Math.random() > 0.5 ? '#fff' : config.color,
          duration: config.duration,
        }];
      });

      // Clean up after animation
      setTimeout(() => {
        setTexts(prev => prev.filter(t => t.id !== id));
      }, config.duration + 100);
    };

    spawn(); // Immediate first text
    intervalRef.current = setInterval(spawn, config.interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stage, isHoldout, holdoutName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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
