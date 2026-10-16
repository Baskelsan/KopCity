// v10 → v11 : coupe nationale. Elle commence à la saison suivante pour une partie en cours.
import type { Migration } from './index';

type Obj = Record<string, unknown>;
type Report = { income: Obj; expenses: Obj; attendance: unknown };

const withCup = (r: Report): Report => ({ ...r, income: { ...r.income, cup: 0 } });

export const v10ToV11: Migration = (save) => {
  const finance = save.finance as { lastWeek: Report | null; season: Report };
  const currentMatch = save.currentMatch as Obj | null;
  return {
    ...save,
    cup: null,
    records: { ...(save.records as Obj), cups: [], cupRuns: [] },
    finance: { lastWeek: finance.lastWeek ? withCup(finance.lastWeek) : null, season: withCup(finance.season) },
    currentMatch: currentMatch ? { ...currentMatch, competition: 'league', cupRound: null } : null,
  };
};
