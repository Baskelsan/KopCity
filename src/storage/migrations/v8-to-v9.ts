// v8 → v9 : statistiques des joueurs (saison et carrière au club) et passeur décisif dans le fil du match.
import type { Migration } from './index';

type Obj = Record<string, unknown>;

const zero = () => ({ apps: 0, goals: 0, assists: 0, ratingTotal: 0 });
const withStats = (p: Obj) => ({ ...p, seasonStats: zero(), careerStats: zero() });

export const v8ToV9: Migration = (save) => {
  const squad = save.squad as Obj;
  const market = save.market as Obj;
  const offseason = save.offseason as Obj | null;
  const events = save.events as Obj;
  const pending = events.pending as Obj | null;
  const currentMatch = save.currentMatch as Obj | null;

  return {
    ...save,
    squad: { ...squad, players: (squad.players as Obj[]).map(withStats) },
    market: {
      ...market,
      offers: (market.offers as Obj[]).map((o) => ({ ...o, player: withStats(o.player as Obj) })),
    },
    offseason: offseason ? { ...offseason, prospects: (offseason.prospects as Obj[]).map(withStats) } : null,
    events: {
      ...events,
      pending: pending ? { ...pending, prodigy: pending.prodigy ? withStats(pending.prodigy as Obj) : null } : null,
    },
    currentMatch: currentMatch
      ? {
          ...currentMatch,
          events: (currentMatch.events as Obj[]).map((e) => (e.type === 'chance' ? { ...e, assistId: null } : e)),
        }
      : null,
  };
};
