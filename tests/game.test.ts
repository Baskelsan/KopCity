import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { applyAction, newGame } from '../src/core/game';
import { SCHEMA_VERSION } from '../src/core/state';

const options = { seed: 1234, now: '2026-10-15T10:00:00.000Z', clubName: 'FC Test' };

describe('newGame', () => {
  it('donne le même état pour les mêmes options', () => {
    expect(newGame(options)).toEqual(newGame(options));
  });

  it('part des valeurs de balance.json', () => {
    const state = newGame(options);
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.club.treasury).toBe(balance.start.treasury);
    expect(state.city.population).toBe(balance.start.population);
    expect(state.city.supporterShare).toBe(balance.start.supporterShare);
    expect(state.city.residentSatisfaction).toBe(balance.start.residentSatisfaction);
    expect(state.league.myDivision).toBe(balance.start.division);
    expect(state.records.bestTreasury).toBe(balance.start.treasury);
    expect(state.time).toEqual({ season: 1, week: 1 });
  });

  it('enregistre la graine et la date fournies', () => {
    const state = newGame(options);
    expect(state.meta.seed).toBe(1234);
    expect(state.meta.rngState).toBe(1234);
    expect(state.meta.createdAt).toBe(options.now);
  });

  it('est sérialisable en JSON sans perte', () => {
    const state = newGame(options);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('applyAction', () => {
  it('active les matchs en direct sans modifier l\'état d\'origine', () => {
    const state = newGame(options);
    const next = applyAction(state, { type: 'setAlwaysLiveMatches', value: true });
    expect(next.settings.alwaysLiveMatches).toBe(true);
    expect(state.settings.alwaysLiveMatches).toBe(false);
  });
});
