// v4 → v5 (M5) : les deux autres divisions, le niveau des équipes, la phase de jeu, le mercato, l'intersaison.
// Les divisions ajoutées rattrapent les journées déjà jouées, pour que leurs classements soient à jour.
import balance from '../../data/balance.json';
import { DIVISIONS, newLeague, recordResult } from '../../core/league';
import { divisionLevel } from '../../core/players';
import { nextInt } from '../../core/rng';
import { simulateAiMatch } from '../../core/season';
import type { Division, DivisionId, Team } from '../../core/state';
import type { Migration } from './index';

type Obj = Record<string, unknown>;

export const v4ToV5: Migration = (save) => {
  const meta = save.meta as Obj;
  const time = save.time as { season: number; week: number };
  const league = save.league as { myDivision: DivisionId; divisions: Division[]; rivalId: string | null };
  const squad = save.squad as Obj;
  let rng = meta.rngState as number;

  // Les équipes existantes reçoivent le niveau de leur division.
  const existing = league.divisions.map((d) => ({
    ...d,
    teams: d.teams.map((t): Team => ({ ...t, level: divisionLevel(d.id) })),
  }));
  const towns = existing.flatMap((d) => d.teams.map((t) => t.name.slice(t.name.indexOf(' ') + 1)));
  const missing = DIVISIONS.filter((id) => !existing.some((d) => d.id === id));
  const generated = newLeague(rng, league.myDivision, missing, towns);
  rng = generated.rngState;

  // Rattrapage des journées déjà jouées dans les nouvelles divisions.
  const caughtUp = generated.value.divisions.map((division) => {
    const teams = new Map(division.teams.map((t) => [t.id, t]));
    let table = division.table;
    const fixtures = division.fixtures.map((f) => {
      if (f.week >= time.week) return f;
      const seed = nextInt(rng, 0, 0xffffffff);
      rng = seed.rngState;
      const result = simulateAiMatch(seed.value, teams.get(f.home)!, teams.get(f.away)!);
      table = recordResult(table, f.home, f.away, result.homeGoals, result.awayGoals);
      return { ...f, result: { ...result, seed: seed.value } };
    });
    return { ...division, fixtures, table };
  });

  const divisions = DIVISIONS.map((id) => existing.find((d) => d.id === id) ?? caughtUp.find((d) => d.id === id)!);
  const players = (squad.players as Obj[]).map((p) => ({ ...p, homegrown: false }));

  return {
    ...save,
    phase: 'season',
    meta: { ...meta, rngState: rng },
    squad: { ...squad, players },
    league: { ...league, divisions },
    market: {
      offers: [],
      open: false,
      lastWinterSeason: time.week > balance.market.winterWeek ? time.season : 0,
    },
    offseason: null,
  };
};
