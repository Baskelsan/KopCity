// v14 → v15 : refonte de la ville. Moins d'emplacements par quartier, un seul logement par quartier (à 3 niveaux),
// ligne « Musée » dans les comptes. Les logements d'un quartier fusionnent en un seul, au niveau de leur nombre
// (3 au plus), sans changer la population. Ce qui ne tient plus dans le quartier est remboursé à 100 %.
import buildings from '../../data/buildings.json';
import districts from '../../data/districts.json';
import type { Migration } from './index';

type Obj = Record<string, unknown>;
type Building = { type: string; level: number };
type Slot = { id: string; building: Building | null };
type District = Obj & { id: string; slots: Slot[] };
type Construction = { slotId: string | null; type: string; level: number; weeksLeft: number };
type Report = { income: Obj; expenses: Obj; attendance: unknown };

const SPECS = buildings as Record<string, { cost: number; levelCosts?: number[]; maxLevel: number }>;
const levelCost = (type: string, level: number) => SPECS[type]?.levelCosts?.[level - 1] ?? SPECS[type]?.cost ?? 0;
const invested = (b: Building) => {
  let total = 0;
  for (let l = 1; l <= b.level; l++) total += levelCost(b.type, l);
  return total;
};
const maxHousingLevel = SPECS.housing!.maxLevel;

const withMuseum = (r: Report): Report => ({ ...r, income: { ...r.income, museum: 0 } });

export const v14ToV15: Migration = (save) => {
  const city = save.city as Obj & { districts: District[]; constructions: Construction[] };
  const club = save.club as Obj & { treasury: number };
  const finance = save.finance as { lastWeek: Report | null; season: Report };
  let refund = 0;
  const constructions: Construction[] = city.constructions.filter((c) => c.slotId === null);

  const newDistricts = city.districts.map((district) => {
    const size = districts.find((d) => d.id === district.id)?.slots ?? district.slots.length;
    // Chaque emplacement occupé (bâtiment et/ou chantier), dans l'ordre.
    const items: { building: Building | null; construction: Construction | null }[] = [];
    let housing: { building: Building } | null = null;
    let housingCount = 0;
    for (const slot of district.slots) {
      const construction = city.constructions.find((c) => c.slotId === slot.id) ?? null;
      if (slot.building?.type === 'housing') {
        housingCount++;
        if (housing) continue;
        housing = { building: { ...slot.building } };
        items.push({ building: housing.building, construction });
        continue;
      }
      if (construction?.type === 'housing' && !slot.building) {
        // Logement en chantier : remboursé, la fusion ne garde que les logements livrés.
        refund += levelCost('housing', construction.level);
        continue;
      }
      if (slot.building || construction) items.push({ building: slot.building, construction });
    }
    if (housing) housing.building.level = Math.min(maxHousingLevel, housingCount);

    const kept = items.slice(0, size);
    for (const item of items.slice(size)) {
      if (item.building) refund += invested(item.building);
      if (item.construction) refund += levelCost(item.construction.type, item.construction.level);
    }
    const slots: Slot[] = Array.from({ length: size }, (_, i) => {
      const id = `${district.id}-${i + 1}`;
      const item = kept[i];
      if (item?.construction) constructions.push({ ...item.construction, slotId: id });
      return { id, building: item?.building ?? null };
    });
    return { ...district, slots };
  });

  return {
    ...save,
    club: { ...club, treasury: club.treasury + refund },
    city: { ...city, districts: newDistricts, constructions },
    finance: { lastWeek: finance.lastWeek ? withMuseum(finance.lastWeek) : null, season: withMuseum(finance.season) },
  };
};
