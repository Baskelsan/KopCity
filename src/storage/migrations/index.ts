import { SCHEMA_VERSION } from '../../core/state';
import { SaveError } from '../errors';
import { v1ToV2 } from './v1-to-v2';
import { v2ToV3 } from './v2-to-v3';

/** Une migration fait passer une sauvegarde de la version N à la version N + 1. */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations indexées par version de départ : migrations[1] fait passer de v1 à v2.
 * Ajouter une entrée (dans un fichier vN-to-vN+1.ts) à chaque incrément de SCHEMA_VERSION.
 */
export const migrations: Readonly<Record<number, Migration>> = {
  1: v1ToV2,
  2: v2ToV3,
};

/** Amène une sauvegarde brute jusqu'à la version cible en appliquant les migrations dans l'ordre. */
export function migrate(
  save: Record<string, unknown>,
  available: Readonly<Record<number, Migration>> = migrations,
  target: number = SCHEMA_VERSION,
): Record<string, unknown> {
  const version = save.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new SaveError('invalidFormat', 'schemaVersion absent ou invalide');
  }
  if (version > target) {
    throw new SaveError('futureVersion', `v${version} > v${target}`);
  }

  let current = save;
  for (let v = version; v < target; v++) {
    const step = available[v];
    if (!step) throw new SaveError('missingMigration', `v${v} → v${v + 1}`);
    current = { ...step(current), schemaVersion: v + 1 };
  }
  return current;
}
