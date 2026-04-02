import PlayerFigure from './PlayerFigure';

const NAMES = [
  'Jan', 'Petra', 'Tomáš', 'Lucie', 'Martin',
  'John', 'Sarah', 'Mike', 'Emma', 'David',
  'Pierre', 'Marie', 'François', 'Camille', 'René',
  'Jakub', 'Anna', 'Ondřej', 'Alice', 'Pavel',
  'Sophie', 'Alex', 'Max', 'Liam', 'Zuzana',
];

export default function FigureGallery() {
  return (
    <div style={{ padding: 40, background: '#f5f0e8', minHeight: '100vh' }}>
      <h2 style={{ fontFamily: 'Georgia', textAlign: 'center', marginBottom: 30 }}>
        Figure Gallery
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px 24px', justifyContent: 'center' }}>
        {NAMES.map(name => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <PlayerFigure name={name} />
            <span style={{
              fontFamily: 'monospace', fontSize: 11,
              padding: '2px 6px', border: '1px solid #d4a853',
              borderRadius: 3, background: '#fffef5',
            }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
