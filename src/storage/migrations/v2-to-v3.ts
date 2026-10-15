// v2 → v3 (M3) : création des quartiers et de leurs emplacements.
import { initialDistricts, unlockDistricts } from '../../core/city';
import type { City, DivisionId } from '../../core/state';
import type { Migration } from './index';

type Obj = Record<string, unknown>;

export const v2ToV3: Migration = (save) => {
  const city = save.city as Obj;
  const league = save.league as Obj;
  if ((city.districts as unknown[]).length > 0) return save;
  const withDistricts = { ...city, districts: initialDistricts() } as unknown as City;
  const { city: unlocked } = unlockDistricts(withDistricts, league.myDivision as DivisionId);
  return { ...save, city: unlocked };
};
