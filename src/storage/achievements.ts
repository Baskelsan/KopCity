// Succès débloqués, gardés à part de la sauvegarde : ils restent d'une partie à l'autre.
import { get, set } from 'idb-keyval';

export const ACHIEVEMENTS_KEY = 'kopcity:achievements';

export interface UnlockedAchievement {
  id: string;
  /** Date ISO du déblocage. */
  unlockedAt: string;
  /** Club avec lequel il a été débloqué. */
  club: string;
}

export async function loadAchievements(): Promise<UnlockedAchievement[]> {
  const raw: unknown = await get(ACHIEVEMENTS_KEY);
  return Array.isArray(raw) ? (raw as UnlockedAchievement[]) : [];
}

/** Ajoute les nouveaux succès (sans doublon) et renvoie la liste complète. */
export async function unlockAchievements(
  ids: string[],
  club: string,
  nowIso: string,
): Promise<{ all: UnlockedAchievement[]; added: UnlockedAchievement[] }> {
  const current = await loadAchievements();
  const known = new Set(current.map((a) => a.id));
  const added = ids.filter((id) => !known.has(id)).map((id) => ({ id, unlockedAt: nowIso, club }));
  if (added.length === 0) return { all: current, added };
  const all = [...current, ...added];
  await set(ACHIEVEMENTS_KEY, all);
  return { all, added };
}
