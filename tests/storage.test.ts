import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyAction, newGame } from '../src/core/game';
import { SCHEMA_VERSION } from '../src/core/state';
import { SaveError } from '../src/storage/errors';
import { migrate, type Migration } from '../src/storage/migrations';
import { deleteGame, loadGame, saveGame } from '../src/storage/save';
import { exportFileName, parseSave, serializeSave } from '../src/storage/serialize';

const NOW = '2026-10-15T10:00:00.000Z';
const LATER = '2026-10-15T11:00:00.000Z';
const game = () =>
  applyAction(newGame({ seed: 42, now: NOW, clubName: 'FC Test' }), { type: 'setAlwaysLiveMatches', value: true });

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof SaveError ? error.code : 'other';
  }
  return undefined;
}

describe('sauvegarde IndexedDB', () => {
  beforeEach(async () => {
    await deleteGame();
  });

  it("renvoie null quand il n'y a pas de partie", async () => {
    expect(await loadGame()).toBeNull();
  });

  it("recharge la partie à l'identique, avec la date de sauvegarde", async () => {
    const state = game();
    await saveGame(state, LATER);
    const loaded = await loadGame();
    expect(loaded).toEqual({ ...state, meta: { ...state.meta, lastSavedAt: LATER } });
  });

  it('écrase la sauvegarde précédente', async () => {
    await saveGame(game(), NOW);
    const other = newGame({ seed: 7, now: NOW, clubName: 'Autre club' });
    await saveGame(other, NOW);
    expect((await loadGame())?.club.name).toBe('Autre club');
  });
});

describe('export et import', () => {
  it("un export se réimporte à l'identique", () => {
    const state = game();
    expect(parseSave(serializeSave(state))).toEqual(state);
  });

  it('nomme le fichier avec la date', () => {
    expect(exportFileName(NOW)).toBe('kop-city-2026-10-15.json');
  });

  it("refuse un fichier qui n'est pas du JSON", () => {
    expect(errorCode(() => parseSave('pas du json'))).toBe('invalidJson');
  });

  it('refuse un JSON qui ne ressemble pas à une sauvegarde', () => {
    expect(errorCode(() => parseSave('[1, 2, 3]'))).toBe('invalidFormat');
    expect(errorCode(() => parseSave('{"hello": "world"}'))).toBe('invalidFormat');
  });

  it('refuse une sauvegarde incomplète', () => {
    const broken = JSON.parse(serializeSave(game()));
    delete broken.club.treasury;
    expect(errorCode(() => parseSave(JSON.stringify(broken)))).toBe('invalidFormat');
    const noCity = JSON.parse(serializeSave(game()));
    delete noCity.city;
    expect(errorCode(() => parseSave(JSON.stringify(noCity)))).toBe('invalidFormat');
  });

  it("refuse une sauvegarde d'une version plus récente du jeu", () => {
    const future = { ...game(), schemaVersion: SCHEMA_VERSION + 1 };
    expect(errorCode(() => parseSave(JSON.stringify(future)))).toBe('futureVersion');
  });
});

describe('migrations', () => {
  // Migrations fictives : la première vraie migration arrivera avec le premier changement de structure.
  const fake: Record<number, Migration> = {
    1: (save) => ({ ...save, renamed: save.original, original: undefined }),
    2: (save) => ({ ...save, added: 'v3' }),
  };

  it("applique les migrations dans l'ordre jusqu'à la version cible", () => {
    const result = migrate({ schemaVersion: 1, original: 'x' }, fake, 3);
    expect(result).toEqual({ schemaVersion: 3, renamed: 'x', original: undefined, added: 'v3' });
  });

  it('ne touche pas une sauvegarde déjà à jour', () => {
    const save = { schemaVersion: 3, value: 1 };
    expect(migrate(save, fake, 3)).toEqual(save);
  });

  it('signale une migration manquante', () => {
    expect(errorCode(() => migrate({ schemaVersion: 1 }, { 1: fake[1]! }, 3))).toBe('missingMigration');
  });

  it('refuse une version absente ou invalide', () => {
    expect(errorCode(() => migrate({}, fake, 3))).toBe('invalidFormat');
    expect(errorCode(() => migrate({ schemaVersion: 0 }, fake, 3))).toBe('invalidFormat');
    expect(errorCode(() => migrate({ schemaVersion: '1' }, fake, 3))).toBe('invalidFormat');
  });

  it('refuse une version future', () => {
    expect(errorCode(() => migrate({ schemaVersion: 4 }, fake, 3))).toBe('futureVersion');
  });
});
