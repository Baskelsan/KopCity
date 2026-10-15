import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { emptyTable, myForm, newLeague, rankOf, recordResult, roundRobin, standings } from '../src/core/league';
import { seedToState } from '../src/core/rng';
import { MY_TEAM_ID } from '../src/core/state';

const ids = ['me', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

describe('calendrier aller-retour', () => {
  const fixtures = roundRobin(ids);

  it('compte 18 journées de 5 matchs', () => {
    expect(fixtures).toHaveLength(90);
    for (let week = 1; week <= 18; week++) expect(fixtures.filter((f) => f.week === week)).toHaveLength(5);
  });

  it('chaque équipe joue une fois par journée, 9 fois à domicile et 9 à l’extérieur', () => {
    for (const id of ids) {
      for (let week = 1; week <= 18; week++) {
        expect(fixtures.filter((f) => f.week === week && (f.home === id || f.away === id))).toHaveLength(1);
      }
      expect(fixtures.filter((f) => f.home === id)).toHaveLength(9);
      expect(fixtures.filter((f) => f.away === id)).toHaveLength(9);
    }
  });

  it('chaque paire se rencontre une fois chez chacun', () => {
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        expect(fixtures.filter((f) => f.home === a && f.away === b)).toHaveLength(1);
      }
    }
  });
});

describe('division générée', () => {
  const league = newLeague(seedToState(3), 'D3').value;
  const division = league.divisions[0]!;

  it('compte 9 adversaires aux noms différents, plus le club', () => {
    expect(division.teams).toHaveLength(balance.league.teamsPerDivision - 1);
    expect(new Set(division.teams.map((t) => t.name)).size).toBe(9);
    expect(division.table.map((r) => r.team)).toContain(MY_TEAM_ID);
    expect(division.teams.every((t) => t.strength.gk > 0)).toBe(true);
  });

  it('chaque adversaire vient d’une ville différente', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const teams = newLeague(seedToState(seed), 'D3').value.divisions[0]!.teams;
      const towns = teams.map((t) => t.name.slice(t.name.indexOf(' ') + 1));
      expect(new Set(towns).size).toBe(teams.length);
    }
  });

  it('désigne un rival parmi les adversaires', () => {
    expect(division.teams.map((t) => t.id)).toContain(league.rivalId);
  });

  it('est déterministe', () => {
    expect(newLeague(seedToState(3), 'D3')).toEqual(newLeague(seedToState(3), 'D3'));
  });
});

describe('classement', () => {
  it('3 points la victoire, 1 le nul, 0 la défaite', () => {
    let table = emptyTable(['x', 'y', 'z']);
    table = recordResult(table, 'x', 'y', 2, 0);
    table = recordResult(table, 'y', 'z', 1, 1);
    const row = (t: string) => table.find((r) => r.team === t)!;
    expect([row('x').points, row('y').points, row('z').points]).toEqual([3, 1, 1]);
    expect(row('y')).toMatchObject({ played: 2, goalsFor: 1, goalsAgainst: 3 });
  });

  it('départage à la différence de buts, puis aux buts marqués', () => {
    let table = emptyTable(['x', 'y', 'z']);
    table = recordResult(table, 'x', 'z', 1, 0);
    table = recordResult(table, 'y', 'z', 3, 1);
    expect(standings(table).map((r) => r.team)).toEqual(['y', 'x', 'z']);
    expect(rankOf(table, 'x')).toBe(2);
  });

  it('la forme du club suit ses résultats dans l’ordre', () => {
    const division = { ...newLeague(seedToState(1), 'D3').value.divisions[0]! };
    const fixtures = division.fixtures.map((f) => {
      if (f.week > 3 || (f.home !== MY_TEAM_ID && f.away !== MY_TEAM_ID)) return f;
      const mineHome = f.home === MY_TEAM_ID;
      const [mine, theirs] = f.week === 1 ? [2, 0] : f.week === 2 ? [1, 1] : [0, 1];
      return { ...f, result: { homeGoals: mineHome ? mine : theirs, awayGoals: mineHome ? theirs : mine, seed: 0 } };
    });
    expect(myForm({ ...division, fixtures })).toEqual(['W', 'D', 'L']);
  });
});
