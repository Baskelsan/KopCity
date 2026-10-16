import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import {
  canBuild,
  canUpgrade,
  findSlot,
  museumWeeklyRevenue,
  populationAt,
  satisfactionTarget,
  withBuilding,
} from '../src/core/city';
import { nextSupporterShare, weekFinance } from '../src/core/economy';
import { applyAction, newGame, type Action } from '../src/core/game';
import { myDivision } from '../src/core/league';
import type { BuildingType, City, DivisionId, GameState } from '../src/core/state';
import { v14ToV15 } from '../src/storage/migrations/v14-to-v15';

const run = (s: GameState, ...a: Action[]) => a.reduce(applyAction, s);
const fresh = (division: DivisionId = 'D3', treasury = 10_000_000): GameState => {
  const s = newGame({ seed: 7, now: 'x', clubName: 'FC Test' });
  return { ...s, club: { ...s.club, treasury }, league: { ...s.league, myDivision: division } };
};
const place = (city: City, slotId: string, type: BuildingType, level = 1): City => ({
  ...withBuilding(city, slotId, type, level),
  population: city.population,
});
const withCity = (s: GameState, city: City): GameState => ({ ...s, city });

describe('logements à niveaux', () => {
  it('3 niveaux à 150 000, 250 000 et 400 000 € pour +2 000, +2 500 et +2 500 habitants', () => {
    expect([1, 2, 3].map((l) => populationAt('housing', l))).toEqual([2000, 4500, 7000]);
    let s = withCity(fresh(), place(fresh().city, 'stade-1', 'housing'));
    expect(canUpgrade(s, 'stade-1')).toMatchObject({ ok: true, cost: 250000 });
    s = withCity(s, place(s.city, 'stade-1', 'housing', 2));
    expect(canUpgrade(s, 'stade-1')).toMatchObject({ ok: true, cost: 400000 });
    s = withCity(s, place(s.city, 'stade-1', 'housing', 3));
    expect(canUpgrade(s, 'stade-1')).toMatchObject({ ok: false, reason: 'maxLevel' });
  });

  it('l’aperçu d’une amélioration ajoute seulement les habitants du nouveau niveau', () => {
    const s = withCity(fresh(), place(fresh().city, 'stade-1', 'housing', 2));
    expect(withBuilding(s.city, 'stade-1', 'housing', 3).population).toBe(s.city.population + 2500);
  });

  it('la démolition retire les habitants de tous les niveaux', () => {
    const city = { ...place(fresh().city, 'stade-1', 'housing', 3), population: 27000 };
    const after = run(withCity(fresh(), city), { type: 'demolish', slotId: 'stade-1' });
    expect(after.city.population).toBe(20000);
  });
});

describe('parc', () => {
  it('riverains +10 dans le quartier du stade, +5 ailleurs, un par quartier', () => {
    const s = fresh();
    const base = satisfactionTarget(s.city);
    expect(satisfactionTarget(place(s.city, 'stade-1', 'park'))).toBe(base + 10);
    const open = { ...s.city, districts: s.city.districts.map((d) => ({ ...d, unlocked: true })) };
    expect(satisfactionTarget(place(open, 'faubourg-1', 'park'))).toBe(base + 5);
    const withPark = withCity(s, place(s.city, 'stade-1', 'park'));
    expect(canBuild(withPark, 'stade-2', 'park')).toMatchObject({ ok: false, reason: 'onePerDistrict' });
  });
});

describe('fan zone', () => {
  it('victoires qui comptent plus, défaites qui comptent moins, plafond à 65 %', () => {
    const S = balance.supporters;
    expect(nextSupporterShare(0.3, 'win', true)).toBeCloseTo(0.3 + S.win * 1.5);
    expect(nextSupporterShare(0.3, 'loss', true)).toBeCloseTo(0.3 + S.loss * 0.5);
    expect(nextSupporterShare(0.6, 'win', false)).toBe(0.6);
    expect(nextSupporterShare(0.645, 'win', true)).toBe(0.65);
  });

  it('une seule dans la ville', () => {
    const s = withCity(fresh(), place(fresh().city, 'stade-1', 'fanzone'));
    expect(canBuild(s, 'stade-2', 'fanzone')).toMatchObject({ ok: false, reason: 'uniqueBuilding' });
  });
});

describe('musée du club', () => {
  it('seulement en Élite, 1,5 M€', () => {
    expect(canBuild(fresh('D2'), 'stade-1', 'museum')).toMatchObject({ ok: false, reason: 'divisionTooLow' });
    expect(canBuild(fresh('D1'), 'stade-1', 'museum')).toMatchObject({ ok: true, cost: 1_500_000 });
  });

  it('rapporte 2 000 € par semaine et par trophée, dans la ligne Musée des comptes', () => {
    const base = fresh('D1');
    const records = {
      ...base.records,
      titles: [...base.records.titles, { season: 1, division: 'D3' }, { season: 2, division: 'D2' }] as typeof base.records.titles,
      cups: [3],
    };
    const s = { ...withCity(base, place(base.city, 'stade-1', 'museum')), records };
    expect(museumWeeklyRevenue(s)).toBe(6000);
    expect(museumWeeklyRevenue({ ...base, records })).toBe(0);
    const opponent = myDivision(s.league).teams[1]!.id;
    expect(weekFinance(s, opponent).income.museum).toBe(6000);
  });
});

describe('migration v14 → v15', () => {
  it('fusionne les logements, compacte les emplacements et rembourse ce qui ne tient plus', () => {
    const v15 = fresh('D2', 1_000_000);
    const slot = (id: string, type: string | null, level = 1) => ({ id, building: type ? { type, level } : null });
    const districts = [
      { id: 'stade', unlocked: true, slots: [slot('stade-1', 'housing'), slot('stade-2', 'bar'), slot('stade-3', 'housing'), slot('stade-4', 'housing')] },
      {
        id: 'faubourg',
        unlocked: true,
        slots: [slot('faubourg-1', 'transport'), slot('faubourg-2', 'academy', 2), slot('faubourg-3', 'shop'), slot('faubourg-4', 'bar'), slot('faubourg-5', null)],
      },
      { id: 'gare', unlocked: true, slots: [slot('gare-1', 'transport'), slot('gare-2', null), slot('gare-3', null), slot('gare-4', null)] },
      { id: 'nouveau', unlocked: false, slots: Array.from({ length: 6 }, (_, i) => slot(`nouveau-${i + 1}`, null)) },
    ];
    const constructions = [
      { slotId: 'faubourg-5', type: 'transport', level: 1, weeksLeft: 2 },
      { slotId: 'gare-2', type: 'housing', level: 1, weeksLeft: 1 },
      { slotId: 'faubourg-2', type: 'academy', level: 3, weeksLeft: 3 },
    ];
    const report = { income: { tickets: 1 }, expenses: {}, attendance: null };
    const old = {
      ...v15,
      schemaVersion: 14,
      city: { ...v15.city, population: 26000, districts, constructions },
      finance: { lastWeek: report, season: report },
    };
    const out = v14ToV15(old as unknown as Record<string, unknown>) as unknown as GameState;
    const types = (id: string) => out.city.districts.find((d) => d.id === id)!.slots.map((s) => s.building && `${s.building.type}${s.building.level}`);
    expect(types('stade')).toEqual(['housing3', 'bar1', null]);
    expect(types('faubourg')).toEqual(['transport1', 'academy2', 'shop1', 'bar1']);
    expect(types('gare')).toEqual(['transport1', null, null]);
    expect(out.city.districts.find((d) => d.id === 'nouveau')!.slots).toHaveLength(4);
    expect(out.city.population).toBe(26000);
    // Le chantier de l'académie suit son bâtiment ; celui du transport (5e emplacement) et le logement en chantier sont remboursés.
    expect(out.city.constructions).toEqual([{ slotId: 'faubourg-2', type: 'academy', level: 3, weeksLeft: 3 }]);
    expect(out.club.treasury).toBe(1_000_000 + 200_000 + 150_000);
    expect(out.finance.season.income.museum).toBe(0);
    expect(findSlot(out.city, 'stade-1')!.slot.building).toEqual({ type: 'housing', level: 3 });
  });
});
