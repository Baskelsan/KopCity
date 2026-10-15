// v5 → v6 : évolution des notes enregistrée à l'intersaison (vide pour une intersaison déjà ouverte).
import type { Migration } from './index';

export const v5ToV6: Migration = (save) => {
  const offseason = save.offseason as Record<string, unknown> | null;
  return offseason ? { ...save, offseason: { ...offseason, ratingChanges: [] } } : save;
};
