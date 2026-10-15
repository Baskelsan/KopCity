// La ville : quartiers, emplacements, chantiers et effets des bâtiments (voir docs/CADRAGE.md, « Système urbain »).
import balance from '../data/balance.json';
import buildingsData from '../data/buildings.json';
import districtsData from '../data/districts.json';
import type {
  BuildingType,
  City,
  Construction,
  ConstructionType,
  District,
  DistrictId,
  DivisionId,
  GameState,
  LogEntry,
  Slot,
} from './state';

const C = balance.city;

export interface BuildingSpec {
  cost: number;
  upkeep: number;
  weeks: number;
  maxLevel: number;
  capacity?: number;
  satisfaction?: number;
  revenuePerSpectator?: number;
  nextBarFactor?: number;
  revenuePerSupporter?: number;
  population?: number;
  accessCap?: number;
  nuisance?: number;
  unique?: boolean;
}

export interface DistrictSpec {
  id: DistrictId;
  slots: number;
  unlock: { population?: number; division?: string };
  commerceFactor: number;
  transportFactor: number;
  nuisance: boolean;
}

export const BUILDINGS = buildingsData as Record<ConstructionType, BuildingSpec>;
export const DISTRICTS = districtsData as DistrictSpec[];
export const SLOT_BUILDINGS: BuildingType[] = ['bar', 'shop', 'housing', 'transport', 'academy'];

const DIVISION_RANK: Record<DivisionId, number> = { D3: 1, D2: 2, D1: 3 };

export function districtSpec(id: DistrictId): DistrictSpec {
  const spec = DISTRICTS.find((d) => d.id === id);
  if (!spec) throw new Error(`Quartier inconnu : ${id}`);
  return spec;
}

/** Quartiers vides au départ d'une partie ; le quartier du stade est ouvert. */
export function initialDistricts(): District[] {
  return DISTRICTS.map((spec) => ({
    id: spec.id,
    unlocked: Object.keys(spec.unlock).length === 0,
    slots: Array.from({ length: spec.slots }, (_, i): Slot => ({ id: `${spec.id}-${i + 1}`, building: null })),
  }));
}

/** Tous les emplacements, avec leur quartier. */
export function allSlots(city: City): { district: District; slot: Slot }[] {
  return city.districts.flatMap((district) => district.slots.map((slot) => ({ district, slot })));
}

export function findSlot(city: City, slotId: string): { district: District; slot: Slot } | undefined {
  return allSlots(city).find((s) => s.slot.id === slotId);
}

/** Bâtiments construits (livrés), avec leur quartier. */
export function builtBuildings(city: City) {
  return allSlots(city).flatMap(({ district, slot }) =>
    slot.building ? [{ district: districtSpec(district.id), slotId: slot.id, ...slot.building }] : [],
  );
}

const countIn = (city: City, type: BuildingType, filter: (d: DistrictSpec) => boolean = () => true) =>
  builtBuildings(city).filter((b) => b.type === type && filter(b.district)).length;

// ——— Valeurs calculées ———

export function stadiumCapacity(city: City): number {
  return C.baseCapacity + city.stadiumLevel * (BUILDINGS.stadium.capacity ?? 0);
}

/** Plafond d'accès : base + chaque parking ou arrêt (compte double dans le quartier de la gare). */
export function accessCap(city: City): number {
  const perTransport = BUILDINGS.transport.accessCap ?? 0;
  return builtBuildings(city)
    .filter((b) => b.type === 'transport')
    .reduce((cap, b) => cap + perTransport * b.district.transportFactor, C.baseAccessCap);
}

export function supporters(city: City): number {
  return Math.round(city.population * city.supporterShare);
}

/** Satisfaction cible = 70 − 5 × paliers − 2 × (bars et logements du quartier du stade) + 5 × transports. */
export function satisfactionTarget(city: City): number {
  let target = C.baseSatisfaction + city.stadiumLevel * (BUILDINGS.stadium.satisfaction ?? 0);
  for (const b of builtBuildings(city)) {
    const spec = BUILDINGS[b.type];
    if (spec.nuisance && b.district.nuisance) target += spec.nuisance;
    if (b.type === 'transport') target += (spec.satisfaction ?? 0) * b.district.transportFactor;
  }
  return Math.min(100, Math.max(0, target));
}

/** Entretien hebdomadaire : stade (base + paliers) et bâtiments (par niveau). */
export function weeklyUpkeep(city: City): number {
  const stadium = C.stadiumBaseUpkeep + city.stadiumLevel * BUILDINGS.stadium.upkeep;
  return builtBuildings(city).reduce((sum, b) => sum + BUILDINGS[b.type].upkeep * b.level, stadium);
}

/**
 * Recette de chaque bar par spectateur et par match à domicile. Les bars à plein effet passent en premier,
 * puis chaque bar suivant rapporte 60 % du précédent.
 */
export function barRates(city: City): { slotId: string; perSpectator: number }[] {
  const spec = BUILDINGS.bar;
  return builtBuildings(city)
    .filter((b) => b.type === 'bar')
    .sort((a, b) => b.district.commerceFactor - a.district.commerceFactor || a.slotId.localeCompare(b.slotId))
    .map((b, i) => ({
      slotId: b.slotId,
      perSpectator: (spec.revenuePerSpectator ?? 0) * b.district.commerceFactor * Math.pow(spec.nextBarFactor ?? 1, i),
    }));
}

/** Recette hebdomadaire des boutiques : supporters × 1 €, à 50 % hors du quartier du stade. */
export function shopWeeklyRevenue(city: City): number {
  const perSupporter = BUILDINGS.shop.revenuePerSupporter ?? 0;
  return builtBuildings(city)
    .filter((b) => b.type === 'shop')
    .reduce((sum, b) => sum + supporters(city) * perSupporter * b.district.commerceFactor, 0);
}

export function academyLevel(city: City): number {
  return builtBuildings(city).find((b) => b.type === 'academy')?.level ?? 0;
}

// ——— Vérifications ———

export type BuildRefusal =
  | 'districtLocked'
  | 'slotOccupied'
  | 'underConstruction'
  | 'maxConstructions'
  | 'notEnoughMoney'
  | 'uniqueBuilding'
  | 'maxLevel'
  | 'lowSatisfaction'
  | 'unknownSlot';

export type BuildCheck = { ok: true; cost: number } | { ok: false; reason: BuildRefusal; cost: number };

const isBusy = (city: City, slotId: string | null) => city.constructions.some((c) => c.slotId === slotId);

function commonChecks(state: GameState, cost: number): BuildCheck | null {
  if (state.city.constructions.length >= C.maxConstructions) return { ok: false, reason: 'maxConstructions', cost };
  if (state.club.treasury - cost < 0) return { ok: false, reason: 'notEnoughMoney', cost };
  return null;
}

/** Peut-on lancer ce bâtiment sur cet emplacement libre ? */
export function canBuild(state: GameState, slotId: string, type: BuildingType): BuildCheck {
  const cost = BUILDINGS[type].cost;
  const found = findSlot(state.city, slotId);
  if (!found) return { ok: false, reason: 'unknownSlot', cost };
  if (!found.district.unlocked) return { ok: false, reason: 'districtLocked', cost };
  if (found.slot.building) return { ok: false, reason: 'slotOccupied', cost };
  if (isBusy(state.city, slotId)) return { ok: false, reason: 'underConstruction', cost };
  if (BUILDINGS[type].unique) {
    const exists =
      countIn(state.city, type) > 0 || state.city.constructions.some((c) => c.type === type);
    if (exists) return { ok: false, reason: 'uniqueBuilding', cost };
  }
  return commonChecks(state, cost) ?? { ok: true, cost };
}

/** Peut-on monter ce bâtiment d'un niveau (centre de formation) ? */
export function canUpgrade(state: GameState, slotId: string): BuildCheck {
  const found = findSlot(state.city, slotId);
  const building = found?.slot.building;
  if (!found || !building) return { ok: false, reason: 'unknownSlot', cost: 0 };
  const spec = BUILDINGS[building.type];
  if (building.level >= spec.maxLevel) return { ok: false, reason: 'maxLevel', cost: spec.cost };
  if (isBusy(state.city, slotId)) return { ok: false, reason: 'underConstruction', cost: spec.cost };
  return commonChecks(state, spec.cost) ?? { ok: true, cost: spec.cost };
}

/** Peut-on lancer le palier suivant du stade ? */
export function canExtendStadium(state: GameState): BuildCheck {
  const spec = BUILDINGS.stadium;
  if (state.city.stadiumLevel >= spec.maxLevel) return { ok: false, reason: 'maxLevel', cost: spec.cost };
  if (isBusy(state.city, null)) return { ok: false, reason: 'underConstruction', cost: spec.cost };
  if (state.city.residentSatisfaction < C.stadiumExtensionMinSatisfaction) {
    return { ok: false, reason: 'lowSatisfaction', cost: spec.cost };
  }
  return commonChecks(state, spec.cost) ?? { ok: true, cost: spec.cost };
}

/** Remboursement à la démolition : 25 % de tout ce qui a été investi (tous niveaux). */
export function demolitionRefund(type: BuildingType, level: number): number {
  return Math.round(BUILDINGS[type].cost * level * C.demolitionRefund);
}

// ——— Actions ———

function startConstruction(state: GameState, construction: Construction, cost: number): GameState {
  return {
    ...state,
    club: { ...state.club, treasury: state.club.treasury - cost },
    city: { ...state.city, constructions: [...state.city.constructions, construction] },
  };
}

export function build(state: GameState, slotId: string, type: BuildingType): GameState {
  const check = canBuild(state, slotId, type);
  if (!check.ok) return state;
  return startConstruction(state, { slotId, type, level: 1, weeksLeft: BUILDINGS[type].weeks }, check.cost);
}

export function upgradeBuilding(state: GameState, slotId: string): GameState {
  const check = canUpgrade(state, slotId);
  const building = findSlot(state.city, slotId)?.slot.building;
  if (!check.ok || !building) return state;
  return startConstruction(
    state,
    { slotId, type: building.type, level: building.level + 1, weeksLeft: BUILDINGS[building.type].weeks },
    check.cost,
  );
}

export function extendStadium(state: GameState): GameState {
  const check = canExtendStadium(state);
  if (!check.ok) return state;
  return startConstruction(
    state,
    { slotId: null, type: 'stadium', level: state.city.stadiumLevel + 1, weeksLeft: BUILDINGS.stadium.weeks },
    check.cost,
  );
}

function mapSlot(city: City, slotId: string, update: (slot: Slot) => Slot): City {
  return {
    ...city,
    districts: city.districts.map((d) => ({
      ...d,
      slots: d.slots.map((s) => (s.id === slotId ? update(s) : s)),
    })),
  };
}

/** La ville telle qu'elle serait avec ce bâtiment livré sur cet emplacement (pour afficher l'effet avant de payer). */
export function withBuilding(city: City, slotId: string, type: BuildingType, level: number): City {
  const next = mapSlot(city, slotId, (s) => ({ ...s, building: { type, level } }));
  const housingNow = findSlot(city, slotId)?.slot.building?.type === 'housing';
  const extra = type === 'housing' && !housingNow ? (BUILDINGS.housing.population ?? 0) : 0;
  return { ...next, population: next.population + extra };
}

/** Démolir : l'emplacement est libéré tout de suite, 25 % de l'investissement est remboursé. */
export function demolish(state: GameState, slotId: string): GameState {
  const building = findSlot(state.city, slotId)?.slot.building;
  if (!building || isBusy(state.city, slotId)) return state;
  const population = building.type === 'housing' ? -(BUILDINGS.housing.population ?? 0) : 0;
  const city = mapSlot(state.city, slotId, (s) => ({ ...s, building: null }));
  return {
    ...state,
    club: { ...state.club, treasury: state.club.treasury + demolitionRefund(building.type, building.level) },
    city: { ...city, population: city.population + population },
  };
}

/** Débloque les quartiers dont la condition est remplie (un quartier débloqué le reste). */
export function unlockDistricts(city: City, division: DivisionId): { city: City; unlocked: DistrictId[] } {
  const unlocked: DistrictId[] = [];
  const districts = city.districts.map((d) => {
    if (d.unlocked) return d;
    const { population, division: minDivision } = districtSpec(d.id).unlock;
    const popOk = population === undefined || city.population >= population;
    const divOk = minDivision === undefined || DIVISION_RANK[division] >= DIVISION_RANK[minDivision as DivisionId];
    if (!popOk || !divOk) return d;
    unlocked.push(d.id);
    return { ...d, unlocked: true };
  });
  return { city: { ...city, districts }, unlocked };
}

/** Fait avancer les chantiers d'une semaine et livre ceux qui sont terminés. */
export function progressConstructions(state: GameState): GameState {
  let city: City = state.city;
  const log: LogEntry[] = [];
  const at = { season: state.time.season, week: state.time.week };
  const remaining: Construction[] = [];

  for (const c of city.constructions) {
    const weeksLeft = c.weeksLeft - 1;
    if (weeksLeft > 0) {
      remaining.push({ ...c, weeksLeft });
      continue;
    }
    if (c.type === 'stadium') {
      city = { ...city, stadiumLevel: c.level };
    } else if (c.slotId) {
      const type = c.type;
      city = mapSlot(city, c.slotId, (s) => ({ ...s, building: { type, level: c.level } }));
      if (type === 'housing') city = { ...city, population: city.population + (BUILDINGS.housing.population ?? 0) };
    }
    log.push({ ...at, key: 'constructionDelivered', params: { type: c.type, level: c.level } });
  }
  city = { ...city, constructions: remaining };

  const unlock = unlockDistricts(city, state.league.myDivision);
  for (const id of unlock.unlocked) log.push({ ...at, key: 'districtUnlocked', params: { district: id } });

  return { ...state, city: unlock.city, log: [...state.log, ...log] };
}
