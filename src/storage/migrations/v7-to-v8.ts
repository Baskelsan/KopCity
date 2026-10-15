// v7 → v8 (M7) : moment du dernier export et temps de jeu.
import type { Migration } from './index';

export const v7ToV8: Migration = (save) => ({
  ...save,
  meta: {
    ...(save.meta as Record<string, unknown>),
    lastExport: null,
    playTime: { total: 0, season: 0, lastSeason: 0 },
  },
});
