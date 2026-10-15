import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyAction, newGame } from '../src/core/game';
import { SCHEMA_VERSION } from '../src/core/state';
import { SaveError } from '../src/storage/errors';
import { migrate, type Migration } from '../src/storage/migrations';
import { v1ToV2 } from '../src/storage/migrations/v1-to-v2';
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

describe('migration v1 → v2', () => {
  /** Une sauvegarde telle que l'écrivait M1 : pas d'effectif, pas de gardien, pas de match en cours. */
  function v1Save(): Record<string, unknown> {
    const { currentMatch: _ignored, ...rest } = newGame({ seed: 42, now: NOW, clubName: 'FC Test' });
    return {
      ...rest,
      schemaVersion: 1,
      meta: { ...rest.meta, rngState: 42 },
      squad: { ...rest.squad, lineup: [], players: [] },
      league: {
        myDivision: 'D3',
        divisions: [{ id: 'D3', teams: [{ id: 't1', name: 'AS Test', strength: { att: 30, mid: 40, def: 50 } }], fixtures: [], table: [] }],
      },
    };
  }

  it('génère un effectif complet et une composition', () => {
    const state = parseSave(JSON.stringify(v1Save()));
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.squad.players).toHaveLength(18);
    expect(state.squad.lineup.filter(Boolean)).toHaveLength(11);
    expect(state.currentMatch).toBeNull();
  });

  it('est déterministe et fait avancer le générateur', () => {
    const a = parseSave(JSON.stringify(v1Save()));
    const b = parseSave(JSON.stringify(v1Save()));
    expect(a).toEqual(b);
    expect(a.meta.rngState).not.toBe(42);
  });

  it('ajoute un gardien aux équipes existantes', () => {
    const v2 = v1ToV2(v1Save()) as { league: { divisions: { teams: { strength: { gk: number } }[] }[] } };
    expect(v2.league.divisions[0]!.teams[0]!.strength.gk).toBe(10);
  });

  it('garde un effectif déjà présent', () => {
    const save = v1Save();
    const players = newGame({ seed: 1, now: NOW, clubName: 'X' }).squad.players;
    save.squad = { ...(save.squad as object), players, lineup: [] };
    expect(parseSave(JSON.stringify(save)).squad.players).toEqual(players);
  });
});

describe('migration v2 → v3', () => {
  it('crée les quartiers vides et ouvre ceux dont la condition est remplie', () => {
    const v3 = newGame({ seed: 42, now: NOW, clubName: 'FC Test' });
    const v2 = {
      ...v3,
      schemaVersion: 2,
      city: { ...v3.city, population: 26000, districts: [] },
    };
    const state = parseSave(JSON.stringify(v2));
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.city.districts.map((d) => [d.id, d.unlocked])).toEqual([
      ['stade', true],
      ['faubourg', true],
      ['gare', false],
      ['nouveau', false],
    ]);
    expect(state.city.districts.flatMap((d) => d.slots)).toHaveLength(19);
  });
});

describe('migration v3 → v4', () => {
  it('crée le championnat, remet la saison à la semaine 1 et abandonne un amical en cours', () => {
    const v4 = newGame({ seed: 42, now: NOW, clubName: 'FC Test' });
    const { finance: _f, alerts: _a, ...rest } = v4;
    const v3 = {
      ...rest,
      schemaVersion: 3,
      time: { season: 1, week: 7 },
      league: { myDivision: 'D3', divisions: [] },
      currentMatch: { finished: true },
    };
    const state = parseSave(JSON.stringify(v3));
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.time.week).toBe(1);
    expect(state.currentMatch).toBeNull();
    expect(state.league.divisions[0]!.fixtures).toHaveLength(90);
    expect(state.league.rivalId).not.toBeNull();
    expect(state.finance.lastWeek).toBeNull();
    expect(state.alerts).toEqual([]);
    expect(state.log).toEqual([]);
  });
});

describe('migration v4 → v5', () => {
  /** Une sauvegarde M4 : une seule division, équipes sans niveau, joueurs sans « formé au club », semaine 7. */
  function v4Save(week: number): Record<string, unknown> {
    const v5 = newGame({ seed: 42, now: NOW, clubName: 'FC Test' });
    const { phase: _p, offseason: _o, ...rest } = v5;
    const d3 = v5.league.divisions.find((d) => d.id === 'D3')!;
    return {
      ...rest,
      schemaVersion: 4,
      time: { season: 1, week },
      market: { offers: [] },
      squad: { ...v5.squad, players: v5.squad.players.map(({ homegrown: _h, ...p }) => p) },
      league: {
        ...v5.league,
        divisions: [{ ...d3, teams: d3.teams.map(({ level: _l, ...t }) => t) }],
      },
    };
  }

  it('ajoute les deux autres divisions, avec des villes différentes', () => {
    const state = parseSave(JSON.stringify(v4Save(1)));
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.league.divisions.map((d) => d.id)).toEqual(['D3', 'D2', 'D1']);
    const teams = state.league.divisions.flatMap((d) => d.teams);
    expect(teams).toHaveLength(29);
    expect(new Set(teams.map((t) => t.name.slice(t.name.indexOf(' ') + 1))).size).toBe(29);
    expect(teams.every((t) => t.level > 0)).toBe(true);
  });

  it('les nouvelles divisions rattrapent les journées déjà jouées', () => {
    const state = parseSave(JSON.stringify(v4Save(7)));
    for (const id of ['D2', 'D1']) {
      const d = state.league.divisions.find((x) => x.id === id)!;
      expect(d.table.every((r) => r.played === 6)).toBe(true);
    }
  });

  it('passe en phase de saison, sans mercato ouvert, joueurs non formés au club', () => {
    const state = parseSave(JSON.stringify(v4Save(12)));
    expect(state.phase).toBe('season');
    expect(state.offseason).toBeNull();
    expect(state.market).toEqual({ offers: [], open: false, lastWinterSeason: 1 });
    expect(state.squad.players.every((p) => p.homegrown === false)).toBe(true);
  });
});
