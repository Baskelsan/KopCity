import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import buildings from '../src/data/buildings.json';
import {
  accessCap,
  barRates,
  canBuild,
  canExtendStadium,
  demolitionRefund,
  findSlot,
  satisfactionTarget,
  shopWeeklyRevenue,
  stadiumCapacity,
  supporters,
  weeklyUpkeep,
} from '../src/core/city';
import { applyAction, newGame, type Action } from '../src/core/game';
import type { BuildingType, GameState } from '../src/core/state';

const C = balance.city;
const fresh = (treasury = 5_000_000): GameState => {
  const s = newGame({ seed: 7, now: 'x', clubName: 'FC Test' });
  return { ...s, club: { ...s.club, treasury } };
};
const run = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);
const weeks = (state: GameState, n: number) =>
  run(state, ...Array.from({ length: n }, (): Action => ({ type: 'advanceWeek' })));
const unlockAll = (state: GameState): GameState => ({
  ...state,
  city: { ...state.city, districts: state.city.districts.map((d) => ({ ...d, unlocked: true })) },
});
/** Pose directement des bâtiments livrés (pour tester les calculs sans attendre les chantiers). */
const place = (state: GameState, items: [string, BuildingType, number?][]): GameState => ({
  ...state,
  city: {
    ...state.city,
    districts: state.city.districts.map((d) => ({
      ...d,
      slots: d.slots.map((s) => {
        const item = items.find(([id]) => id === s.id);
        return item ? { ...s, building: { type: item[1], level: item[2] ?? 1 } } : s;
      }),
    })),
  },
});

describe('quartiers', () => {
  it('démarrent avec le seul quartier du stade ouvert et 19 emplacements vides', () => {
    const { city } = fresh();
    expect(city.districts.map((d) => [d.id, d.unlocked, d.slots.length])).toEqual([
      ['stade', true, 4],
      ['faubourg', false, 5],
      ['gare', false, 4],
      ['nouveau', false, 6],
    ]);
    expect(city.districts.every((d) => d.slots.every((s) => s.building === null))).toBe(true);
  });

  it('refusent de construire dans un quartier verrouillé', () => {
    expect(canBuild(fresh(), 'faubourg-1', 'housing')).toMatchObject({ ok: false, reason: 'districtLocked' });
  });

  it('le Faubourg se débloque à 26 000 habitants', () => {
    let s = run(fresh(), { type: 'build', slotId: 'stade-1', building: 'housing' }, { type: 'build', slotId: 'stade-2', building: 'housing' });
    s = weeks(s, buildings.housing.weeks);
    expect(s.city.population).toBe(24000);
    expect(s.city.districts[1]!.unlocked).toBe(false);
    s = weeks(run(s, { type: 'build', slotId: 'stade-3', building: 'housing' }), buildings.housing.weeks);
    expect(s.city.population).toBe(26000);
    expect(s.city.districts[1]!.unlocked).toBe(true);
    expect(s.log.some((e) => e.key === 'districtUnlocked' && e.params?.district === 'faubourg')).toBe(true);
  });

  it('la gare demande la Division 2, le Nouveau quartier l’Élite et 40 000 habitants', () => {
    const d2 = weeks({ ...fresh(), league: { ...fresh().league, myDivision: 'D2' } }, 1);
    expect(d2.city.districts.find((d) => d.id === 'gare')!.unlocked).toBe(true);
    expect(d2.city.districts.find((d) => d.id === 'nouveau')!.unlocked).toBe(false);
    const elite = { ...fresh(), league: { ...fresh().league, myDivision: 'D1' as const } };
    expect(weeks(elite, 1).city.districts.find((d) => d.id === 'nouveau')!.unlocked).toBe(false);
    const big = { ...elite, city: { ...elite.city, population: 40000 } };
    expect(weeks(big, 1).city.districts.find((d) => d.id === 'nouveau')!.unlocked).toBe(true);
  });
});

describe('chantiers', () => {
  it('le coût est payé au lancement', () => {
    const s = run(fresh(100_000), { type: 'build', slotId: 'stade-1', building: 'bar' });
    expect(s.club.treasury).toBe(100_000 - buildings.bar.cost);
    expect(s.city.constructions).toEqual([{ slotId: 'stade-1', type: 'bar', level: 1, weeksLeft: buildings.bar.weeks }]);
  });

  it('aucun achat ne fait passer la trésorerie sous zéro', () => {
    const exact = run(fresh(buildings.bar.cost), { type: 'build', slotId: 'stade-1', building: 'bar' });
    expect(exact.club.treasury).toBe(0);
    const short = fresh(buildings.bar.cost - 1);
    expect(canBuild(short, 'stade-1', 'bar')).toMatchObject({ ok: false, reason: 'notEnoughMoney' });
    expect(run(short, { type: 'build', slotId: 'stade-1', building: 'bar' })).toBe(short);
    const poorStadium = fresh(buildings.stadium.cost - 1);
    expect(run(poorStadium, { type: 'extendStadium' })).toBe(poorStadium);
  });

  it('pas plus de 2 chantiers en même temps', () => {
    const s = run(
      fresh(),
      { type: 'build', slotId: 'stade-1', building: 'bar' },
      { type: 'build', slotId: 'stade-2', building: 'shop' },
    );
    expect(canBuild(s, 'stade-3', 'housing')).toMatchObject({ ok: false, reason: 'maxConstructions' });
    expect(canExtendStadium(s)).toMatchObject({ ok: false, reason: 'maxConstructions' });
    expect(run(s, { type: 'build', slotId: 'stade-3', building: 'housing' })).toBe(s);
  });

  it('un emplacement en chantier ou occupé est refusé', () => {
    const s = run(fresh(), { type: 'build', slotId: 'stade-1', building: 'bar' });
    expect(canBuild(s, 'stade-1', 'shop')).toMatchObject({ ok: false, reason: 'underConstruction' });
    const built = weeks(s, buildings.bar.weeks);
    expect(canBuild(built, 'stade-1', 'shop')).toMatchObject({ ok: false, reason: 'slotOccupied' });
  });

  it.each(['bar', 'shop', 'housing', 'transport', 'academy'] as BuildingType[])(
    '%s est livré après exactement sa durée',
    (type) => {
      const duration = buildings[type].weeks;
      const started = run(fresh(), { type: 'build', slotId: 'stade-1', building: type });
      const almost = weeks(started, duration - 1);
      expect(findSlot(almost.city, 'stade-1')!.slot.building).toBeNull();
      expect(almost.city.constructions[0]!.weeksLeft).toBe(1);
      const done = weeks(almost, 1);
      expect(findSlot(done.city, 'stade-1')!.slot.building).toEqual({ type, level: 1 });
      expect(done.city.constructions).toEqual([]);
      expect(done.log.at(-1)).toMatchObject({ key: 'constructionDelivered', params: { type, level: 1 } });
    },
  );

  it('le stade gagne 2 000 places par palier après 6 semaines, jusqu’à 3 paliers', () => {
    let s = run(fresh(), { type: 'extendStadium' });
    expect(stadiumCapacity(weeks(s, buildings.stadium.weeks - 1).city)).toBe(C.baseCapacity);
    s = weeks(s, buildings.stadium.weeks);
    expect(s.city.stadiumLevel).toBe(1);
    expect(stadiumCapacity(s.city)).toBe(C.baseCapacity + buildings.stadium.capacity);
    s = weeks(run(s, { type: 'extendStadium' }), 6);
    s = weeks(run(s, { type: 'extendStadium' }), 6);
    expect(s.city.stadiumLevel).toBe(3);
    expect(canExtendStadium(s)).toMatchObject({ ok: false, reason: 'maxLevel' });
  });

  it('le stade ne s’agrandit plus quand les riverains sont sous 40', () => {
    const s = fresh();
    const angry = { ...s, city: { ...s.city, residentSatisfaction: C.stadiumExtensionMinSatisfaction - 1 } };
    expect(canExtendStadium(angry)).toMatchObject({ ok: false, reason: 'lowSatisfaction' });
    const ok = { ...s, city: { ...s.city, residentSatisfaction: C.stadiumExtensionMinSatisfaction } };
    expect(canExtendStadium(ok).ok).toBe(true);
  });

  it('une seule boutique dans toute la ville, même en chantier', () => {
    const s = run(unlockAll(fresh()), { type: 'build', slotId: 'stade-1', building: 'shop' });
    expect(canBuild(s, 'faubourg-1', 'shop')).toMatchObject({ ok: false, reason: 'uniqueBuilding' });
    const built = weeks(s, buildings.shop.weeks);
    expect(canBuild(built, 'faubourg-1', 'shop')).toMatchObject({ ok: false, reason: 'uniqueBuilding' });
    const demolished = run(built, { type: 'demolish', slotId: 'stade-1' });
    expect(canBuild(demolished, 'faubourg-1', 'shop').ok).toBe(true);
  });

  it('un seul bar par quartier, mais un bar dans chaque quartier', () => {
    const s = run(unlockAll(fresh()), { type: 'build', slotId: 'stade-1', building: 'bar' });
    expect(canBuild(s, 'stade-2', 'bar')).toMatchObject({ ok: false, reason: 'onePerDistrict' });
    expect(canBuild(weeks(s, 2), 'stade-2', 'bar')).toMatchObject({ ok: false, reason: 'onePerDistrict' });
    expect(canBuild(s, 'faubourg-1', 'bar').ok).toBe(true);
  });

  it('logements et transports restent libres', () => {
    const s = run(fresh(), { type: 'build', slotId: 'stade-1', building: 'housing' });
    expect(canBuild(s, 'stade-2', 'housing').ok).toBe(true);
    const t = run(fresh(), { type: 'build', slotId: 'stade-1', building: 'transport' });
    expect(canBuild(t, 'stade-2', 'transport').ok).toBe(true);
  });

  it('un seul centre de formation, qui monte jusqu’au niveau 3', () => {
    let s = run(fresh(), { type: 'build', slotId: 'stade-1', building: 'academy' });
    expect(canBuild(s, 'stade-2', 'academy')).toMatchObject({ ok: false, reason: 'uniqueBuilding' });
    s = weeks(s, 6);
    expect(canBuild(s, 'stade-2', 'academy')).toMatchObject({ ok: false, reason: 'uniqueBuilding' });
    s = weeks(run(s, { type: 'upgradeBuilding', slotId: 'stade-1' }), 6);
    s = weeks(run(s, { type: 'upgradeBuilding', slotId: 'stade-1' }), 6);
    expect(findSlot(s.city, 'stade-1')!.slot.building).toEqual({ type: 'academy', level: 3 });
    expect(run(s, { type: 'upgradeBuilding', slotId: 'stade-1' })).toBe(s);
  });

  it('les bâtiments à un seul niveau ne s’améliorent pas', () => {
    const s = weeks(run(fresh(), { type: 'build', slotId: 'stade-1', building: 'bar' }), 2);
    expect(run(s, { type: 'upgradeBuilding', slotId: 'stade-1' })).toBe(s);
  });
});

describe('démolition', () => {
  it('libère l’emplacement tout de suite et rembourse 25 % du coût', () => {
    const s = weeks(run(fresh(500_000), { type: 'build', slotId: 'stade-1', building: 'bar' }), 2);
    const after = run(s, { type: 'demolish', slotId: 'stade-1' });
    expect(findSlot(after.city, 'stade-1')!.slot.building).toBeNull();
    expect(after.club.treasury).toBe(s.club.treasury + buildings.bar.cost * 0.25);
  });

  it('rembourse 25 % de tous les niveaux investis', () => {
    expect(demolitionRefund('academy', 3)).toBe(187500);
  });

  it('retire les habitants des logements démolis', () => {
    const s = weeks(run(fresh(), { type: 'build', slotId: 'stade-1', building: 'housing' }), 4);
    expect(run(s, { type: 'demolish', slotId: 'stade-1' }).city.population).toBe(20000);
  });

  it('ne démolit ni un emplacement vide ni un chantier en cours', () => {
    const s = fresh();
    expect(run(s, { type: 'demolish', slotId: 'stade-1' })).toBe(s);
    const upgrading = run(
      place(s, [['stade-1', 'academy', 1]]),
      { type: 'upgradeBuilding', slotId: 'stade-1' },
    );
    expect(run(upgrading, { type: 'demolish', slotId: 'stade-1' })).toBe(upgrading);
  });
});

describe('effets chiffrés', () => {
  it('valeurs de départ', () => {
    const { city } = fresh();
    expect(stadiumCapacity(city)).toBe(6000);
    expect(accessCap(city)).toBe(7000);
    expect(supporters(city)).toBe(4000);
    expect(satisfactionTarget(city)).toBe(70);
    expect(weeklyUpkeep(city)).toBe(4000);
  });

  it('satisfaction cible = 70 − 5 × paliers − 2 × bars et logements du quartier du stade + 5 × transports', () => {
    let s = unlockAll(fresh());
    s = { ...s, city: { ...s.city, stadiumLevel: 2 } };
    s = place(s, [
      ['stade-1', 'bar'],
      ['stade-2', 'housing'],
      ['stade-3', 'transport'],
      ['faubourg-1', 'bar'],
      ['faubourg-2', 'housing'],
      ['nouveau-1', 'transport'],
    ]);
    // 70 − 10 − 2 − 2 + 5 + 5 ; les bar et logements du Faubourg ne gênent pas.
    expect(satisfactionTarget(s.city)).toBe(66);
  });

  it('dans le quartier de la gare, un transport compte double', () => {
    const s = place(unlockAll(fresh()), [['gare-1', 'transport']]);
    expect(accessCap(s.city)).toBe(7000 + 5000);
    expect(satisfactionTarget(s.city)).toBe(80);
    const elsewhere = place(unlockAll(fresh()), [['faubourg-1', 'transport']]);
    expect(accessCap(elsewhere.city)).toBe(7000 + 2500);
    expect(satisfactionTarget(elsewhere.city)).toBe(75);
  });

  it('la satisfaction cible reste entre 0 et 100', () => {
    const s = place(unlockAll(fresh()), [
      ['gare-1', 'transport'],
      ['gare-2', 'transport'],
      ['gare-3', 'transport'],
      ['gare-4', 'transport'],
    ]);
    expect(satisfactionTarget(s.city)).toBe(100);
  });

  it('bars : 1,5 € par spectateur, 50 % hors du quartier du stade, chaque bar suivant à 60 %', () => {
    const s = place(unlockAll(fresh()), [
      ['faubourg-1', 'bar'],
      ['stade-1', 'bar'],
      ['gare-1', 'bar'],
    ]);
    const rates = barRates(s.city);
    expect(rates.map((r) => r.slotId)).toEqual(['stade-1', 'faubourg-1', 'gare-1']);
    expect(rates[0]!.perSpectator).toBeCloseTo(1.5);
    expect(rates[1]!.perSpectator).toBeCloseTo(1.5 * 0.5 * 0.6);
    expect(rates[2]!.perSpectator).toBeCloseTo(1.5 * 0.5 * 0.36);
  });

  it('boutique : supporters × 1 € par semaine, 50 % hors du quartier du stade', () => {
    const inStade = place(fresh(), [['stade-1', 'shop']]);
    expect(shopWeeklyRevenue(inStade.city)).toBe(4000);
    const outside = place(unlockAll(fresh()), [['faubourg-1', 'shop']]);
    expect(shopWeeklyRevenue(outside.city)).toBe(2000);
  });

  it('entretien : stade, paliers et bâtiments selon leur niveau', () => {
    let s = place(fresh(), [
      ['stade-1', 'bar'],
      ['stade-2', 'academy', 2],
    ]);
    s = { ...s, city: { ...s.city, stadiumLevel: 1 } };
    expect(weeklyUpkeep(s.city)).toBe(4000 + 5000 + 800 + 3000 * 2);
  });
});

describe('semaine suivante', () => {
  it('fait avancer le compteur de semaines', () => {
    expect(weeks(fresh(), 3).time.week).toBe(4);
  });

  it('ne fait rien pendant un match en cours', () => {
    const s = run(fresh(), { type: 'startFriendly', live: true });
    expect(run(s, { type: 'advanceWeek' })).toBe(s);
  });
});
