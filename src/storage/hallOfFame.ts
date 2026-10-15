// Palmarès des parties terminées, gardé à part de la sauvegarde courante.
import { get, set } from 'idb-keyval';
import type { GameSummary } from '../core/records';

export const HALL_OF_FAME_KEY = 'kopcity:halloffame';

export async function loadHallOfFame(): Promise<GameSummary[]> {
  const raw: unknown = await get(HALL_OF_FAME_KEY);
  return Array.isArray(raw) ? (raw as GameSummary[]) : [];
}

export async function addToHallOfFame(summary: GameSummary): Promise<GameSummary[]> {
  const all = [...(await loadHallOfFame()), summary];
  await set(HALL_OF_FAME_KEY, all);
  return all;
}
