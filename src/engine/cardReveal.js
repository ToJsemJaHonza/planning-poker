export const CARD_FLIP_MS = 700;
export const MAX_CARD_STAGGER_MS = 400;
export const cardStagger = (index) => Math.min(MAX_CARD_STAGGER_MS, Math.max(0, index) * 80);
export const resultDelay = (count, splitMode, motionMode) => motionMode === 'full'
  ? cardStagger(count - 1) + (splitMode ? 100 : 0) + CARD_FLIP_MS + 100
  : 0;
