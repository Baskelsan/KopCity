import balance from '../data/balance.json';
import { seedToState } from './rng';
import {
  SCHEMA_VERSION,
  type DivisionId,
  type Formation,
  type GameState,
  type PlayStyle,
} from './state';

export interface NewGameOptions {
  seed: number;
  /** Date ISO de création, fournie par l'appelant. */
  now: string;
  clubName: string;
  clubColors?: [string, string];
}

/** Crée l'état de départ d'une partie. Même options = même état. */
export function newGame({ seed, now, clubName, clubColors }: NewGameOptions): GameState {
  const start = balance.start;
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { createdAt: now, lastSavedAt: now, seed, rngState: seedToState(seed) },
    settings: { alwaysLiveMatches: false },
    time: { season: 1, week: 1 },
    club: {
      name: clubName,
      colors: clubColors ?? (start.clubColors as [string, string]),
      treasury: start.treasury,
      weeksInRed: 0,
    },
    squad: {
      formation: start.formation as Formation,
      style: start.style as PlayStyle,
      autoLineup: true,
      lineup: [],
      players: [],
    },
    city: {
      stadiumLevel: start.stadiumLevel,
      population: start.population,
      supporterShare: start.supporterShare,
      residentSatisfaction: start.residentSatisfaction,
      districts: [],
      constructions: [],
    },
    league: { myDivision: start.division as DivisionId, divisions: [] },
    market: { offers: [] },
    events: { pending: null, history: [] },
    objectives: [],
    records: { titles: 0, promotions: 0, bestAttendance: 0, bestTreasury: start.treasury },
    log: [],
  };
}

export type Action = { type: 'setAlwaysLiveMatches'; value: boolean };

/** Point d'entrée unique pour faire évoluer l'état : (state, action) => newState. */
export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'setAlwaysLiveMatches':
      return { ...state, settings: { ...state.settings, alwaysLiveMatches: action.value } };
  }
}
