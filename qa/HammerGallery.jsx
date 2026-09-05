import { useRef, useState } from 'react';
import PmSprite from '../src/components/PmSprite';
import { conceptsA } from './hammer-concepts-a';
import { conceptsB } from './hammer-concepts-b';
import { conceptsC } from './hammer-concepts-c';

const concepts = [...conceptsA, ...conceptsB, ...conceptsC].sort((a, b) => a.id - b.id);
const font = {
  A:'010101111101101', B:'110101110101110', C:'111100100100111', D:'110101101101110',
  E:'111100110100111', F:'111100110100100', G:'111100101101111', H:'101101111101101',
  I:'111010010010111', J:'001001001101111', K:'101101110101101', L:'100100100100111',
  M:'101111111101101', N:'101111111111101', O:'111101101101111', P:'110101110100100',
  Q:'111101101111001', R:'110101110101101', S:'111100111001111', T:'111010010010010',
  U:'101101101101111', V:'101101101101010', W:'101101111111101', X:'101101010101101',
  Y:'101101010010010', Z:'111001010100111', '0':'111101101101111', '1':'010110010010111',
  '2':'110001010100111', '3':'110001010001110', '4':'101101111001001', '5':'111100110001110',
  '6':'011100111101111', '7':'111001010010010', '8':'111101111101111', '9':'111101111001110',
  '+':'000010111010000', '-':'000000111000000', '!':'010010010000010', '?':'110001010000010',
  '/':'001001010100100', ' ':'000000000000000',
};
const poses = { Carry: 18, 'Wind-up': -100, Impact: 95 };

function Hammer({ concept, angle }) {
  return <svg data-design-hammer={concept.id} viewBox="0 0 120 140" width="120" height="140"
    shapeRendering="crispEdges" aria-label={`${concept.title} pixel hammer`}
    style={{ position: 'absolute', left: -25, top: -80, transformOrigin: '60px 120px', transform: `rotate(${angle}deg)` }}>
    {concept.shapes.map((r, i) => <rect key={i} x={r.x * 5} y={r.y * 5} width={r.w * 5} height={r.h * 5} fill={r.fill} />)}
    {concept.labels.map((label, i) => <g key={i} data-bitmap-label={label.text} fill={label.color}>
      {[...label.text].flatMap((letter, index) => [...(font[letter] || font['?'])].map((bit, p) => bit === '1'
        ? <rect key={`${index}:${p}`} x={(label.x + (index * 4 + p % 3) * label.pixel) * 5}
          y={(label.y + Math.floor(p / 3) * (label.pixelY || label.pixel)) * 5} width={label.pixel * 5} height={(label.pixelY || label.pixel) * 5} /> : null))}
    </g>)}
  </svg>;
}

function InHand({ concept, pose, large = false }) {
  return <div className={`hammer-scene${large ? ' hammer-scene--large' : ''}`}>
    <div className="hammer-ground" />
    <div className="hammer-actor">
      <PmSprite model={{ mode: 'ceremony', pose: 'walk', walkFrame: 0, showBubble: false, facingLeft: false,
        hammer: concept.id === 4 ? { angle: poses[pose] } : null }} />
      {concept.id !== 4 && <><Hammer concept={concept} angle={poses[pose]} /><div className="hammer-knuckles" /></>}
    </div>
  </div>;
}

export default function HammerGallery() {
  const [selected, setSelected] = useState(null);
  const [pose, setPose] = useState('Carry');
  const [expanded, setExpanded] = useState(false);
  const inspectButton = useRef(null);
  const close = () => { setExpanded(false); inspectButton.current?.focus(); };
  const dialogKeys = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key !== 'Tab') return;
    const buttons = [...e.currentTarget.querySelectorAll('button')];
    const first = buttons[0], last = buttons.at(-1);
    if (e.shiftKey && e.target === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && e.target === last) { e.preventDefault(); first.focus(); }
  };
  const pick = concepts.find(c => c.id === selected);
  return <main className="hammer-gallery">
    <header className="hammer-gallery-header">
      <div><span className="hammer-kicker">PLANNING POKER / PROP DESIGN</span>
        <h1>THE BONK COUNCIL</h1>
        <p>10 original concepts. Pick your weapon.</p>
      </div>
      <span className="hammer-preview-tag">PREVIEW ONLY</span>
    </header>
    <p className="hammer-disclaimer">Creative references to 10 designers — independent concepts, not their work or endorsement.</p>
    <div className="hammer-toolbar" aria-label="Hammer pose">
      {Object.keys(poses).map(p => <button key={p} aria-pressed={pose === p} onClick={() => setPose(p)}>{p}</button>)}
      <output aria-live="polite">{pick ? `Your pick: #${String(pick.id).padStart(2, '0')} — ${pick.title}` : 'Select any concept to compare it up close.'}</output>
      {pick && <button ref={inspectButton} onClick={() => setExpanded(true)}>Inspect 2×</button>}
    </div>
    <section className="hammer-concept-grid" aria-label="Ten hammer concepts">
      {concepts.map(c => <button className="hammer-concept" key={c.id} aria-pressed={selected === c.id}
        aria-label={`Select concept ${c.id}: ${c.title}`} onClick={() => setSelected(c.id)}>
        <div className="hammer-concept-heading"><span className="hammer-number">{String(c.id).padStart(2, '0')}</span><h2>{c.title}</h2></div>
        <InHand concept={c} pose={pose} />
        <div className="hammer-concept-copy"><span className="hammer-reference">Reference: {c.inspiration}</span>
          <p>{c.tagline}</p><blockquote>“{c.quote}”</blockquote></div>
      </button>)}
    </section>
    {expanded && pick && <div className="hammer-detail-backdrop" onClick={close}>
      <section className="hammer-detail" role="dialog" aria-modal="true" aria-label={`Inspect ${pick.title}`} onClick={e => e.stopPropagation()} onKeyDown={dialogKeys}>
        <div className="hammer-detail-heading"><h2>#{String(pick.id).padStart(2, '0')} {pick.title}</h2><button autoFocus onClick={close}>Close</button></div>
        <InHand concept={pick} pose={pose} large />
        <div className="hammer-toolbar">{Object.keys(poses).map(p => <button key={p} aria-pressed={pose === p} onClick={() => setPose(p)}>{p}</button>)}</div>
        <p>{pick.quote}</p>
      </section>
    </div>}
  </main>;
}
