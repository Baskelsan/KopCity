import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import buildings from '../src/data/buildings.json';
import { canBuild, canExtendStadium, canUpgrade, findSlot, stadiumCapacity, weeklyUpkeep } from '../src/core/city';
import { staffInjuryFactor, staffStrengthFactor } from '../src/core/effects';
import { staffWeeklyCost, weekFinance } from '../src/core/economy';
import { applyAction, newGame, type Action } from '../src/core/game';
import { myDivision } from '../src/core/league';
import { autoLineup, benchOf } from '../src/core/lineup';
import { createMatch, simulateToEnd } from '../src/core/match';
import { agePlayer, generateMarket } from '../src/core/offseason';
import { divisionLevel, generatePlayer, generateSquad, lineRating, starsShown, transferValue } from '../src/core/players';
import { seedToState } from '../src/core/rng';
import type { DivisionId, GameState, Player } from '../src/core/state';
import { generateOpponent } from '../src/core/strength';
import { v13ToV14 } from '../src/storage/migrations/v13-to-v14';

const C = balance.city;
const run = (s: GameState, ...a: Action[]) => a.reduce(applyAction, s);
const inDivision = (division: DivisionId, treasury = 20_000_000): GameState => {
  const s = newGame({ seed: 7, now: 'x', clubName: 'FC Test' });
  return { ...s, club: { ...s.club, treasury }, league: { ...s.league, myDivision: division } };
};
/** Livre tous les chantiers en cours. */
const deliver = (s: GameState): GameState => {
  let city = s.city;
  for (const c of city.constructions) {
    if (c.type === 'stadium') city = { ...city, stadiumLevel: city.stadiumLevel + 1 };
    else {
      const districts = city.districts.map((d) => ({
        ...d,
        slots: d.slots.map((slot) => (slot.id === c.slotId ? { ...slot, building: { type: c.type as never, level: c.level } } : slot)),
      }));
      city = { ...city, districts };
    }
  }
  return { ...s, city: { ...city, constructions: [] } };
};

describe('stade : paliers 4 et 5 en Élite', () => {
  const atLevel3 = (division: DivisionId): GameState => {
    const s = inDivision(division);
    return { ...s, city: { ...s.city, stadiumLevel: 3 } };
  };

  it('hors Élite, le stade s’arrête au palier 3', () => {
    expect(canExtendStadium(atLevel3('D2'))).toMatchObject({ ok: false, reason: 'divisionTooLow' });
  });

  it('en Élite : 2 M€ puis 4 M€, +3 000 places et plus d’entretien à chaque palier, jusqu’au palier 5', () => {
    let s = atLevel3('D1');
    const capacity3 = stadiumCapacity(s.city);
    const upkeep3 = weeklyUpkeep(s.city);
    expect(canExtendStadium(s)).toMatchObject({ ok: true, cost: 2_000_000 });
    s = deliver(run(s, { type: 'extendStadium' }));
    expect(stadiumCapacity(s.city)).toBe(capacity3 + 3000);
    expect(weeklyUpkeep(s.city)).toBe(upkeep3 + 15000);
    expect(canExtendStadium(s)).toMatchObject({ ok: true, cost: 4_000_000 });
    s = deliver(run(s, { type: 'extendStadium' }));
    expect(stadiumCapacity(s.city)).toBe(C.baseCapacity + 3 * 2000 + 2 * 3000);
    expect(weeklyUpkeep(s.city)).toBe(upkeep3 + 15000 + 25000);
    expect(canExtendStadium(s)).toMatchObject({ ok: false, reason: 'maxLevel' });
  });
});

describe('centre d’entraînement', () => {
  const slot = 'stade-1';

  it('pas avant la Division 2, puis 1 M€, 2 M€ et 4 M€ par niveau', () => {
    expect(canBuild(inDivision('D3'), slot, 'training')).toMatchObject({ ok: false, reason: 'divisionTooLow' });
    let s = inDivision('D2');
    expect(canBuild(s, slot, 'training')).toMatchObject({ ok: true, cost: 1_000_000 });
    const upkeep0 = weeklyUpkeep(s.city);
    s = deliver(run(s, { type: 'build', slotId: slot, building: 'training' }));
    expect(weeklyUpkeep(s.city)).toBe(upkeep0 + 25000);
    expect(canUpgrade(s, slot)).toMatchObject({ ok: true, cost: 2_000_000 });
    s = deliver(run(s, { type: 'upgradeBuilding', slotId: slot }));
    expect(weeklyUpkeep(s.city)).toBe(upkeep0 + 50000);
    expect(canUpgrade(s, slot)).toMatchObject({ ok: true, cost: 4_000_000 });
    s = deliver(run(s, { type: 'upgradeBuilding', slotId: slot }));
    expect(findSlot(s.city, slot)!.slot.building).toEqual({ type: 'training', level: 3 });
    expect(weeklyUpkeep(s.city)).toBe(upkeep0 + 100000);
    expect(canBuild(s, 'stade-2', 'training')).toMatchObject({ ok: false, reason: 'uniqueBuilding' });
    expect(buildings.training.weeks).toBe(8);
  });

  const young = (seed: number): Player => ({
    ...generatePlayer(seedToState(seed), 'MIL', 10, { ageMin: 22, ageMax: 22, potential: 20 }).value,
  });
  const gain = (training: number) => {
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const p = young(seed);
      const aged = agePlayer(seedToState(seed * 31), p, 0, training).value;
      total += lineRating(aged, 'MIL') - lineRating(p, 'MIL');
    }
    return total / 200;
  };

  it('fait progresser les joueurs de 29 ans ou moins, d’autant plus que le niveau est haut', () => {
    expect(gain(1)).toBeGreaterThan(gain(0));
    expect(gain(3)).toBeGreaterThan(gain(1));
  });

  it('ne dépasse jamais le potentiel', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = { ...young(seed), potential: 11 };
      const aged = agePlayer(seedToState(seed), p, 0, 3).value;
      expect(lineRating(aged, 'MIL')).toBeLessThanOrEqual(Math.max(11, lineRating(p, 'MIL')));
    }
  });

  it('au niveau 3, les plus de 31 ans perdent 1 point de moins', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const p = generatePlayer(seedToState(seed), 'DEF', 14, { ageMin: 33, ageMax: 33 }).value;
      const without = agePlayer(seedToState(seed), p, 0, 0).value;
      const with3 = agePlayer(seedToState(seed), p, 0, 3).value;
      for (const key of Object.keys(p.stats) as (keyof Player['stats'])[]) {
        const loss = p.stats[key] - without.stats[key];
        expect(p.stats[key] - with3.stats[key]).toBe(Math.max(0, loss - 1));
      }
    }
  });
});

describe('staff', () => {
  it('s’embauche et se licencie, et se paie chaque semaine dans la ligne Staff', () => {
    const s = run(inDivision('D3'), { type: 'setStaff', role: 'physio', hired: true }, { type: 'setStaff', role: 'analyst', hired: true });
    expect(s.staff).toEqual({ physio: true, scout: false, analyst: true });
    const cost = balance.staff.physio.weeklyCost + balance.staff.analyst.weeklyCost;
    expect(staffWeeklyCost(s)).toBe(cost);
    const opponent = myDivision(s.league).teams[1]!.id;
    expect(weekFinance(s, opponent).expenses.staff).toBe(cost);
    expect(run(s, { type: 'setStaff', role: 'physio', hired: false }).staff.physio).toBe(false);
  });

  it('analyste : +3 % de force ; préparateur : facteur de blessure 0,6', () => {
    const s = run(inDivision('D3'), { type: 'setStaff', role: 'physio', hired: true }, { type: 'setStaff', role: 'analyst', hired: true });
    expect(staffStrengthFactor(s)).toBe(1.03);
    expect(staffInjuryFactor(s)).toBe(0.6);
    expect(staffStrengthFactor(inDivision('D3'))).toBe(1);
  });

  it('préparateur physique : moins de blessures et plus courtes', () => {
    const squad = generateSquad(seedToState(77), 10).value;
    const onField = autoLineup(squad, '4-4-2');
    const opponent = generateOpponent(seedToState(5), 10, 'o').value;
    const injuries = (factor: number) => {
      let count = 0;
      let weeks = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const match = createMatch({
          seed,
          live: false,
          home: { name: 'Club', strength: null },
          away: { name: opponent.name, strength: opponent.strength },
          clubSide: 'home',
          onField,
          bench: benchOf(squad, onField),
          style: 'balanced',
          clubInjuryFactor: factor,
        });
        const end = simulateToEnd(match, { players: squad, formation: '4-4-2' });
        count += end.injuries.length;
        weeks += end.injuries.reduce((t, i) => t + i.weeks, 0);
      }
      return { count, average: weeks / Math.max(1, count) };
    };
    const normal = injuries(1);
    const physio = injuries(0.6);
    expect(physio.count).toBeLessThan(normal.count * 0.8);
    expect(physio.average).toBeLessThan(normal.average);
  });

  it('recruteur : 10 joueurs dont 2 d’un niveau au-dessus, étoiles exactes', () => {
    const offers = generateMarket(seedToState(4), 'D3', true).value;
    expect(offers).toHaveLength(balance.staff.scout.offers);
    for (const { player } of offers) expect(player.potentialStarsShown).toBe(starsShown(player.potential, 0));
  });
});

describe('marché des stars', () => {
  it('rien en Division 3', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(generateMarket(seedToState(seed), 'D3').value.some((o) => o.star)).toBe(false);
    }
  });

  it('en Division 2 et en Élite : 1 ou 2 vedettes au-dessus du niveau, vendues 1,5 fois leur valeur', () => {
    for (const division of ['D2', 'D1'] as DivisionId[]) {
      for (let seed = 1; seed <= 20; seed++) {
        const stars = generateMarket(seedToState(seed), division).value.filter((o) => o.star);
        expect(stars.length).toBeGreaterThanOrEqual(1);
        expect(stars.length).toBeLessThanOrEqual(2);
        for (const { player, price } of stars) {
          const value = transferValue(player);
          expect(Math.abs(price - value * 1.5)).toBeLessThanOrEqual(balance.market.valueRounding / 2);
          expect(lineRating(player, player.pos)).toBeGreaterThanOrEqual(Math.min(20, Math.floor(divisionLevel(division) + 1)));
        }
      }
    }
  });
});

describe('migration v13 → v14', () => {
  it('ajoute un staff vide et la ligne Staff des comptes', () => {
    const report = { income: {}, expenses: { wages: 1 }, attendance: null };
    const out = v13ToV14({ schemaVersion: 13, finance: { lastWeek: report, season: report } });
    expect(out.staff).toEqual({ physio: false, scout: false, analyst: false });
    expect((out.finance as { season: { expenses: Record<string, number> } }).season.expenses).toEqual({ wages: 1, staff: 0 });
  });
});
