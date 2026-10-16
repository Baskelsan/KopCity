// v9 → v10 : prix du billet réglable et demandes d'augmentation à l'intersaison.
import type { Migration } from './index';

type Obj = Record<string, unknown>;

export const v9ToV10: Migration = (save) => {
  const offseason = save.offseason as Obj | null;
  return {
    ...save,
    club: { ...(save.club as Obj), ticketPriceFactor: 1 },
    offseason: offseason ? { ...offseason, raiseRequests: [] } : null,
  };
};
