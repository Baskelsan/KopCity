import type { GameState } from '../core/state';
import { SaveError } from './errors';
import { migrate } from './migrations';
import { assertGameState } from './validate';

/** Transforme une sauvegarde brute (lue en base ou importée) en état valide à la version courante. */
export function restoreSave(raw: unknown): GameState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SaveError('invalidFormat', 'pas un objet');
  }
  return assertGameState(migrate(raw as Record<string, unknown>));
}

/** Texte du fichier d'export. */
export function serializeSave(state: GameState): string {
  return JSON.stringify(state, null, 2);
}

/** Lit le texte d'un fichier d'export. */
export function parseSave(text: string): GameState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError('invalidJson');
  }
  return restoreSave(raw);
}

/** Nom du fichier d'export, à partir d'une date ISO : kop-city-2026-10-15.json */
export function exportFileName(nowIso: string): string {
  return `kop-city-${nowIso.slice(0, 10)}.json`;
}
