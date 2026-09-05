import { useState } from 'react';
import PlayerFigure from './PlayerFigure';
import PmSprite from './PmSprite';
import { pixel } from './room/styles';

const NAMES = [
  'Jan', 'Petra', 'Tomáš', 'Lucie', 'Martin',
  'John', 'Sarah', 'Mike', 'Emma', 'David',
  'Pierre', 'Marie', 'François', 'Camille', 'René',
  'Jakub', 'Anna', 'Ondřej', 'Alice', 'Pavel',
  'Sophie', 'Alex', 'Max', 'Liam', 'Zuzana',
];

export default function FigureGallery() {
  const [state, setState] = useState('Idle');
  const poses = { Idle: {}, 'Step 1': { walkFrame: 0 }, 'Step 2': { walkFrame: 1 }, 'Hands on hips': { pose: 'hips' }, 'Holding card': { holdingCard: true }, Peeking: { fukEyes: true }, Stress: { stressStage: 5 } };
  const tile = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 8px 10px', minWidth: 84 };
  return (
    <div style={{ padding: '28px 16px', background: '#f5f0e8', minHeight: '100vh', color: '#2c3e50', fontFamily: pixel }}>
      <h2 style={{ fontSize: '1rem', lineHeight: 1.8, textAlign: 'center', marginBottom: 24 }}>
        Figure Gallery
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {Object.keys(poses).map(label => <button key={label} aria-pressed={state === label} onClick={() => setState(label)} style={{ fontFamily: pixel, fontSize: '.5rem', padding: '10px 12px', border: '2px solid #2c3e50', background: state === label ? '#2c3e50' : '#fffdf6', color: state === label ? '#f5c542' : '#2c3e50', cursor: 'pointer' }}>{label}</button>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px 24px', justifyContent: 'center' }}>
        <div style={{ ...tile, border: '2px solid #b8922e', background: '#ece4d0' }}>
          <PmSprite model={{ mode: 'ceremony', pose: 'walk', walkFrame: poses[state].walkFrame ?? 0 }} />
          <span style={{ fontSize: '.5rem' }}>PM</span>
        </div>
        {NAMES.map(name => (
          <div key={name} data-gallery-figure={name} style={tile}>
            <PlayerFigure name={name} {...poses[state]} />
            <span style={{
              fontFamily: pixel, fontSize: 8,
              padding: '2px 6px', border: '1px solid #d4a853',
              background: '#fffef5',
            }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
