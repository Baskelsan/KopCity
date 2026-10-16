// v12 → v13 : compteur de demandes d'augmentation refusées, par joueur.
import type { Migration } from './index';

type Obj = Record<string, unknown>;

const withCounter = (p: Obj) => ({ ...p, refusedRaises: 0 });

export const v12ToV13: Migration = (save) => {
  const squad = save.squad as Obj;
  const market = save.market as Obj;
  const offseason = save.offseason as Obj | null;
  const events = save.events as Obj;
  const pending = events.pending as Obj | null;
  return {
    ...save,
    squad: { ...squad, players: (squad.players as Obj[]).map(withCounter) },
    market: { ...market, offers: (market.offers as Obj[]).map((o) => ({ ...o, player: withCounter(o.player as Obj) })) },
    offseason: offseason ? { ...offseason, prospects: (offseason.prospects as Obj[]).map(withCounter) } : null,
    events: {
      ...events,
      pending: pending ? { ...pending, prodigy: pending.prodigy ? withCounter(pending.prodigy as Obj) : null } : null,
    },
  };
};
