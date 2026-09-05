// Sampled from PM's suit, pointer, shirt and gold accents.
export const MOTION_PALETTE = {
  ink: '#1a1a2e', navy: '#2c3e50', blue: '#3498db',
  paper: '#f5f0e4', white: '#fffdf6', gold: '#f5c542',
  ochre: '#b8922e', red: '#c0392b', dust: '#b5a48a',
};
export const clamp01 = value => Math.max(0, Math.min(1, value));
export const easeOut = value => 1 - (1 - clamp01(value)) ** 3;
export const envelope = (elapsed, duration, enter = 180, exit = 280) =>
  Math.min(clamp01(elapsed / enter), clamp01((duration - elapsed) / exit));
