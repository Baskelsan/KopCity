import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { generateSquad, lineRating, monthlySalary, overall, starsShown, weeklyWages } from '../src/core/players';
import { seedToState } from '../src/core/rng';
import type { Player } from '../src/core/state';

const squadOf = (seed: number, level = 10) => generateSquad(seedToState(seed), level).value;

const player = (pos: Player['pos'], stats: Player['stats']): Player => ({
  id: 'x',
  name: 'X',
  pos,
  age: 25,
  stats,
  potential: 10,
  potentialStarsShown: 2.5,
  morale: 70,
  monthlySalary: 0,
  contractYears: 1,
  injuryWeeks: 0,
  homegrown: false,
  seasonStats: { apps: 0, goals: 0, assists: 0, ratingTotal: 0 },
  careerStats: { apps: 0, goals: 0, assists: 0, ratingTotal: 0 },
});

describe("génération de l'effectif", () => {
  it('crée 18 joueurs : 2 GAR, 6 DEF, 6 MIL, 4 ATT', () => {
    const squad = squadOf(1);
    expect(squad).toHaveLength(18);
    const count = (pos: string) => squad.filter((p) => p.pos === pos).length;
    expect([count('GAR'), count('DEF'), count('MIL'), count('ATT')]).toEqual([2, 6, 6, 4]);
  });

  it('donne le même effectif pour la même graine', () => {
    expect(squadOf(5)).toEqual(squadOf(5));
    expect(squadOf(5)).not.toEqual(squadOf(6));
  });

  it('respecte les bornes de chaque attribut', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const p of squadOf(seed)) {
        for (const value of Object.values(p.stats)) {
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(20);
        }
        expect(p.age).toBeGreaterThanOrEqual(balance.players.ageMin);
        expect(p.age).toBeLessThanOrEqual(balance.players.ageMax);
        expect(p.potential).toBeGreaterThanOrEqual(overall(p));
        expect(p.potential).toBeLessThanOrEqual(20);
        expect(p.potentialStarsShown * 2).toBe(Math.round(p.potentialStarsShown * 2));
        expect(p.morale).toBe(balance.players.startMorale);
        expect(p.injuryWeeks).toBe(0);
      }
    }
  });

  it('génère des identifiants uniques', () => {
    const squad = squadOf(3);
    expect(new Set(squad.map((p) => p.id)).size).toBe(18);
  });

  it('vise une masse salariale de départ autour de 40 000 € par semaine', () => {
    let total = 0;
    const runs = 200;
    for (let seed = 0; seed < runs; seed++) total += weeklyWages(squadOf(seed));
    const average = total / runs;
    expect(average).toBeGreaterThan(36000);
    expect(average).toBeLessThan(44000);
  });

  it('suit le niveau de la division', () => {
    const avg = (level: number) => {
      const squad = squadOf(9, level);
      return squad.reduce((sum, p) => sum + overall(p), 0) / squad.length;
    };
    expect(avg(16)).toBeGreaterThan(avg(10) + 4);
  });
});

describe('étoiles de potentiel', () => {
  it('valent le potentiel ÷ 4 plus l’erreur, à la demi-étoile', () => {
    expect(starsShown(12, 0)).toBe(3);
    expect(starsShown(12, 0.6)).toBe(3.5);
    expect(starsShown(12, -1)).toBe(2);
    expect(starsShown(15, 0)).toBe(4);
  });

  it('restent entre 0,5 et 5', () => {
    expect(starsShown(1, -1)).toBe(0.5);
    expect(starsShown(20, 1)).toBe(5);
  });
});

describe('valeur des joueurs', () => {
  it('pondère les stats selon la ligne', () => {
    const striker = player('ATT', { att: 15, def: 5, pas: 10, phy: 10 });
    expect(lineRating(striker, 'ATT')).toBeCloseTo(15 * 0.6 + 10 * 0.2 + 10 * 0.2);
  });

  it('pénalise un joueur hors de son poste, et plus fort dans les buts', () => {
    const mid = player('MIL', { att: 10, def: 10, pas: 10, phy: 10 });
    const asMid = lineRating(mid, 'MIL');
    expect(lineRating(mid, 'DEF')).toBeCloseTo(10 * balance.strength.outOfPositionFactor);
    expect(lineRating(mid, 'GAR')).toBeCloseTo(asMid * balance.strength.outOfPositionGoalkeeperFactor);
  });

  it('paie davantage les meilleurs joueurs', () => {
    expect(monthlySalary(14)).toBeGreaterThan(monthlySalary(10));
    expect(monthlySalary(10)).toBe(balance.players.salary.monthlyAtReference);
  });
});
