// v6 → v7 (M6) : événements, effets temporaires, objectifs, palmarès détaillé, faillite.
import { drawObjectives } from '../../core/objectives';
import { emptyRecords } from '../../core/records';
import type { Migration } from './index';

type Obj = Record<string, unknown>;
type Report = { income: Obj; expenses: Obj; attendance: unknown };

export const v6ToV7: Migration = (save) => {
  const meta = save.meta as Obj;
  const club = save.club as Obj;
  const old = save.records as { promotions?: number; bestAttendance?: number; bestTreasury?: number };
  const offseason = save.offseason as Obj | null;
  const currentMatch = save.currentMatch as { club: Obj } | null;

  let rngState = meta.rngState as number;
  let objectives: unknown[] = [];
  if (save.phase === 'season') {
    const drawn = drawObjectives(rngState);
    rngState = drawn.rngState;
    objectives = drawn.value;
  }

  // Les anciens titres n'étaient qu'un compteur : on ne sait plus dans quelle division, on repart à zéro.
  const base = emptyRecords(old.bestTreasury ?? (club.treasury as number));
  const records = {
    ...base,
    promotions: old.promotions ?? 0,
    bestAttendance: old.bestAttendance ?? 0,
    seasonStart: { ...base.seasonStart, bestAttendance: old.bestAttendance ?? 0 },
  };

  const finance = save.finance as { lastWeek: Report | null; season: Report };
  const withOther = (r: Report): Report => ({ income: { ...r.income, other: 0 }, expenses: { ...r.expenses, other: 0 }, attendance: r.attendance });

  return {
    ...save,
    meta: { ...meta, rngState },
    finance: { lastWeek: finance.lastWeek ? withOther(finance.lastWeek) : null, season: withOther(finance.season) },
    club: { ...club, sponsorMultiplier: 1 },
    events: { pending: null, history: [], lastRoll: null },
    objectives,
    records,
    effects: [],
    gameOver: null,
    offseason: offseason ? { ...offseason, objectiveResults: [], recordsBeaten: [] } : null,
    currentMatch: currentMatch ? { ...currentMatch, club: { ...currentMatch.club, strengthFactor: 1 } } : null,
  };
};
