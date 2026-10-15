import { del, get, set } from 'idb-keyval';
import type { GameState } from '../core/state';
import { restoreSave } from './serialize';

/** Une seule sauvegarde courante, écrasée à chaque enregistrement. */
export const SAVE_KEY = 'kopcity:save';

export async function loadGame(): Promise<GameState | null> {
  const raw: unknown = await get(SAVE_KEY);
  if (raw === undefined) return null;
  return restoreSave(raw);
}

/** Enregistre l'état ; la date de sauvegarde est fournie par l'appelant. */
export async function saveGame(state: GameState, nowIso: string): Promise<void> {
  await set(SAVE_KEY, { ...state, meta: { ...state.meta, lastSavedAt: nowIso } });
}

export async function deleteGame(): Promise<void> {
  await del(SAVE_KEY);
}

/**
 * Demande au navigateur de ne pas effacer les données (iOS peut purger le stockage).
 * Renvoie true si le stockage est persistant.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
