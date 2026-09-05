import { MOTION_PALETTE as color } from '../engine/motionStyle';

// The caller's existing timeline drives feet, contact shadow and trailing dust.
export default function PixelRunner({ elapsed, duration, width, height, top, strideMs = 150, className, children }) {
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const x = (vw + width * 2) * elapsed / duration - width;
  const step = Math.abs(Math.sin(elapsed / strideMs * Math.PI));
  return <div className={className} data-pixel-runner style={{ position: 'absolute', left: 0, top, width, height, transform: `translateX(${x}px)` }}>
    <div aria-hidden="true" style={{ position: 'absolute', left: 8, right: 6, height: 4, bottom: -3, background: color.ink, opacity: 0.16, transform: `scaleX(${1 - step * 0.12})`, boxShadow: '4px -2px 0 #1a1a2e, -4px -2px 0 #1a1a2e' }} />
    {[0, 1, 2, 3].map(i => {
      const p = ((elapsed + i * 140) % 600) / 600;
      return <i key={i} aria-hidden="true" style={{ position: 'absolute', left: -p * 30, bottom: p * 7, width: 3, height: 3, background: color.dust, opacity: (1 - p) * 0.6 }} />;
    })}
    <div data-runner-body style={{ position: 'absolute', inset: 0, transform: `translateY(${-step * 2}px)` }}>{children}</div>
  </div>;
}
