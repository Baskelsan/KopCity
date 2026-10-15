// v3 → v4 (M4) : championnat de la division du club, comptes, alertes.
// Les matchs amicaux disparaissent : un amical en cours est abandonné, la saison repart de la semaine 1
// et le journal est vidé (ses numéros de semaine ne correspondraient plus).
import { emptyReport } from '../../core/economy';
import { newLeague } from '../../core/league';
import type { DivisionId } from '../../core/state';
import type { Migration } from './index';

type Obj = Record<string, unknown>;

export const v3ToV4: Migration = (save) => {
  const meta = save.meta as Obj;
  const league = save.league as Obj;
  const time = save.time as Obj;
  const generated = newLeague(meta.rngState as number, league.myDivision as DivisionId);
  return {
    ...save,
    meta: { ...meta, rngState: generated.rngState },
    time: { ...time, week: 1 },
    league: generated.value,
    log: [],
    currentMatch: null,
    finance: { lastWeek: null, season: emptyReport() },
    alerts: [],
  };
};
