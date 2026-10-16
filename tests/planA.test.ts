import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { newGame } from '../src/core/game';
import { agePlayer, endSeason, generateProspects, startingElevenLevel } from '../src/core/offseason';
import { overall } from '../src/core/players';
import { seedToState } from '../src/core/rng';
import { MY_TEAM_ID, type GameState, type TableRow } from '../src/core/state';

describe('progression plus lente', () => {
  it('au niveau 3 du centre avec 50 000 habitants, un potentiel de 19 ou plus reste rare', () => {
    let total = 0;
    let stars = 0;
    for (let seed = 1; seed <= 300; seed++) {
      for (const p of generateProspects(seedToState(seed), 3, 50000).value) {
        total++;
        if (p.potential >= 19) stars++;
      }
    }
    expect(stars / total).toBeLessThan(0.15);
  });

  it('le centre de formation donne un petit coup de pouce aux jeunes formés au club', () => {
    const base = newGame({ seed: 1, now: 'x', clubName: 'C' }).squad.players[5]!;
    const young = { ...base, age: 18, potential: 20, homegrown: true, stats: { att: 8, def: 8, pas: 8, phy: 8 } };
    const avgGain = (academy: number) => {
      let gain = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const aged = agePlayer(seedToState(seed), young, academy).value;
        gain += Object.values(aged.stats).reduce((a, b) => a + b, 0) - 32;
      }
      return gain / 300;
    };
    const bonus = avgGain(3) - avgGain(0);
    // Environ 4 stats × 45 % = +1,8 point au total par saison.
    expect(bonus).toBeGreaterThan(1.2);
    expect(bonus).toBeLessThan(2.4);
  });
});

describe('une Élite qui se renforce', () => {
  /** Club en Élite avec une équipe très forte, en fin de saison. */
  function dominantInElite(rating: number): GameState {
    const s = newGame({ seed: 4, now: 'x', clubName: 'C' });
    // Des joueurs de 25 ans sous contrat longtemps : l'équipe reste la même d'une saison à l'autre.
    const players = s.squad.players.map((p) => ({ ...p, age: 25, contractYears: 20, stats: { att: rating, def: rating, pas: rating, phy: rating } }));
    const elite = s.league.divisions.find((d) => d.id === 'D1')!;
    const d3 = s.league.divisions.find((d) => d.id === 'D3')!;
    // Le club prend la place d'une équipe d'Élite (et inversement), 5e du classement pour ne pas bouger.
    const swapped = elite.teams[0]!;
    const eliteTeams = elite.teams.slice(1);
    const table: TableRow[] = [...eliteTeams.map((t) => t.id).slice(0, 4), MY_TEAM_ID, ...eliteTeams.map((t) => t.id).slice(4)].map(
      (team, i) => ({ team, played: 18, points: 40 - i * 3, goalsFor: 20, goalsAgainst: 20 }),
    );
    return {
      ...s,
      time: { season: 1, week: 19 },
      squad: { ...s.squad, players },
      league: {
        ...s.league,
        myDivision: 'D1',
        divisions: s.league.divisions.map((d) =>
          d.id === 'D1'
            ? { ...d, teams: eliteTeams, table }
            : d.id === 'D3'
              ? { ...d, teams: [...d3.teams, swapped], table: d3.table.filter((r) => r.team !== MY_TEAM_ID).concat([{ team: swapped.id, played: 18, points: 0, goalsFor: 0, goalsAgainst: 0 }]) }
              : d,
        ),
      },
    };
  }

  it('quand le club domine, les clubs d’Élite visent son niveau moins 1,5 (au plus 19)', () => {
    const strong = dominantInElite(20);
    expect(startingElevenLevel(strong)).toBeGreaterThan(18);
    const avgLevel = (s: GameState) => {
      const teams = s.league.divisions.find((d) => d.id === 'D1')!.teams;
      return teams.reduce((sum, t) => sum + t.level, 0) / teams.length;
    };
    const before = avgLevel(strong);
    let s = strong;
    for (let i = 0; i < 6; i++) s = { ...endSeason({ ...s, phase: 'season', time: { season: i + 1, week: 19 } }), phase: 'season' };
    expect(avgLevel(s)).toBeGreaterThan(before + 1);
    expect(Math.max(...s.league.divisions.find((d) => d.id === 'D1')!.teams.map((t) => t.level))).toBeLessThan(
      balance.teams.eliteMaxLevel + 2,
    );
  });

  it('un club moyen ne fait pas monter l’Élite au-dessus de son niveau habituel', () => {
    const average = dominantInElite(12);
    const target = balance.players.divisionLevel.D1;
    let s = average;
    for (let i = 0; i < 6; i++) s = { ...endSeason({ ...s, phase: 'season', time: { season: i + 1, week: 19 } }), phase: 'season' };
    const teams = s.league.divisions.find((d) => d.id === 'D1')!.teams;
    const avg = teams.reduce((sum, t) => sum + t.level, 0) / teams.length;
    expect(avg).toBeLessThan(target + 1);
    expect(overall).toBeDefined();
  });
});
