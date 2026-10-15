import balance from '../data/balance.json';
import { build, demolish, extendStadium, initialDistricts, upgradeBuilding } from './city';
import { emptyReport } from './economy';
import { newLeague } from './league';
import { autoLineup, swapInLineup } from './lineup';
import { decide, type ClubContext } from './match';
import type { Decision } from './matchTypes';
import {
  buyPlayer,
  declineProspect,
  renewContract,
  sellPlayer,
  signProspect,
  startSeason,
} from './offseason';
import { divisionLevel, generateSquad } from './players';
import { seedToState } from './rng';
import { advance, finishLiveMatch } from './season';
import {
  SCHEMA_VERSION,
  type BuildingType,
  type DivisionId,
  type Formation,
  type GameState,
  type PlayStyle,
  type Squad,
} from './state';

export interface NewGameOptions {
  seed: number;
  /** Date ISO de création, fournie par l'appelant. */
  now: string;
  clubName: string;
  clubColors?: [string, string];
}

/** Effectif de départ généré avec le générateur de la partie. */
export function startingSquad(
  rngState: number,
  division: DivisionId,
  formation: Formation,
  style: PlayStyle,
): { squad: Squad; rngState: number } {
  const draw = generateSquad(rngState, divisionLevel(division));
  return {
    squad: { formation, style, autoLineup: true, lineup: autoLineup(draw.value, formation), players: draw.value },
    rngState: draw.rngState,
  };
}

/** Crée l'état de départ d'une partie. Même options = même état. */
export function newGame({ seed, now, clubName, clubColors }: NewGameOptions): GameState {
  const start = balance.start;
  const division = start.division as DivisionId;
  const squad = startingSquad(seedToState(seed), division, start.formation as Formation, start.style as PlayStyle);
  const league = newLeague(squad.rngState, division);
  return {
    schemaVersion: SCHEMA_VERSION,
    phase: 'season',
    meta: { createdAt: now, lastSavedAt: now, seed, rngState: league.rngState },
    settings: { alwaysLiveMatches: false },
    time: { season: 1, week: 1 },
    club: {
      name: clubName,
      colors: clubColors ?? (start.clubColors as [string, string]),
      treasury: start.treasury,
      weeksInRed: 0,
    },
    squad: squad.squad,
    city: {
      stadiumLevel: start.stadiumLevel,
      population: start.population,
      supporterShare: start.supporterShare,
      residentSatisfaction: start.residentSatisfaction,
      districts: initialDistricts(),
      constructions: [],
    },
    league: league.value,
    market: { offers: [], open: false, lastWinterSeason: 0 },
    events: { pending: null, history: [] },
    objectives: [],
    records: { titles: 0, promotions: 0, bestAttendance: 0, bestTreasury: start.treasury },
    log: [],
    currentMatch: null,
    finance: { lastWeek: null, season: emptyReport() },
    alerts: [],
    offseason: null,
  };
}

export type Action =
  | { type: 'setAlwaysLiveMatches'; value: boolean }
  | { type: 'setFormation'; formation: Formation }
  | { type: 'setStyle'; style: PlayStyle }
  | { type: 'setAutoLineup'; value: boolean }
  | { type: 'swapPlayers'; a: string; b: string }
  | { type: 'advance' }
  | { type: 'matchDecision'; decision: Decision }
  | { type: 'finishMatch' }
  | { type: 'build'; slotId: string; building: BuildingType }
  | { type: 'upgradeBuilding'; slotId: string }
  | { type: 'extendStadium' }
  | { type: 'demolish'; slotId: string }
  | { type: 'renewContract'; playerId: string; years: number }
  | { type: 'signProspect'; playerId: string }
  | { type: 'declineProspect'; playerId: string }
  | { type: 'buyPlayer'; playerId: string }
  | { type: 'sellPlayer'; playerId: string }
  | { type: 'startSeason' };

const clubContext = (state: GameState): ClubContext => ({
  players: state.squad.players,
  formation: state.squad.formation,
});

/** Recalcule la composition si elle est automatique. */
function refreshLineup(squad: Squad): Squad {
  return squad.autoLineup ? { ...squad, lineup: autoLineup(squad.players, squad.formation) } : squad;
}

/** Point d'entrée unique pour faire évoluer l'état : (state, action) => newState. */
export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'setAlwaysLiveMatches':
      return { ...state, settings: { ...state.settings, alwaysLiveMatches: action.value } };
    case 'setFormation':
      return { ...state, squad: refreshLineup({ ...state.squad, formation: action.formation }) };
    case 'setStyle':
      return { ...state, squad: { ...state.squad, style: action.style } };
    case 'setAutoLineup':
      return { ...state, squad: refreshLineup({ ...state.squad, autoLineup: action.value }) };
    case 'swapPlayers':
      return {
        ...state,
        squad: { ...state.squad, autoLineup: false, lineup: swapInLineup(state.squad.lineup, action.a, action.b) },
      };
    case 'advance':
      return advance(state);
    case 'matchDecision':
      if (!state.currentMatch || state.currentMatch.pending.length === 0) return state;
      return { ...state, currentMatch: decide(state.currentMatch, action.decision, clubContext(state)) };
    case 'finishMatch':
      return finishLiveMatch(state);
    case 'build':
      return build(state, action.slotId, action.building);
    case 'upgradeBuilding':
      return upgradeBuilding(state, action.slotId);
    case 'extendStadium':
      return extendStadium(state);
    case 'demolish':
      return demolish(state, action.slotId);
    case 'renewContract':
      return renewContract(state, action.playerId, action.years);
    case 'signProspect':
      return signProspect(state, action.playerId);
    case 'declineProspect':
      return declineProspect(state, action.playerId);
    case 'buyPlayer':
      return buyPlayer(state, action.playerId);
    case 'sellPlayer':
      return sellPlayer(state, action.playerId);
    case 'startSeason':
      return startSeason(state);
  }
}
