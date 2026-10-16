import balance from '../data/balance.json';
import { build, demolish, extendStadium, initialDistricts, upgradeBuilding } from './city';
import { cupByes, newCup } from './cup';
import { clampTicketFactor, emptyReport, recordOtherMoney } from './economy';
import { resolveEvent } from './events';
import { drawObjectives } from './objectives';
import { emptyRecords } from './records';
import { newLeague } from './league';
import { autoLineup, swapInLineup } from './lineup';
import { decide, type ClubContext } from './match';
import type { Decision } from './matchTypes';
import {
  answerRaise,
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
  type StaffRole,
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
  const cup = newCup(league.rngState, league.value, 1, cupByes(league.value));
  const objectives = drawObjectives(cup.rngState);
  return {
    schemaVersion: SCHEMA_VERSION,
    phase: 'season',
    meta: {
      createdAt: now,
      lastSavedAt: now,
      seed,
      rngState: objectives.rngState,
      lastExport: null,
      playTime: { total: 0, season: 0, lastSeason: 0 },
    },
    settings: { alwaysLiveMatches: false },
    time: { season: 1, week: 1 },
    club: {
      name: clubName,
      colors: clubColors ?? (start.clubColors as [string, string]),
      treasury: start.treasury,
      weeksInRed: 0,
      sponsorMultiplier: 1,
      ticketPriceFactor: 1,
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
    events: { pending: null, history: [], lastRoll: null },
    objectives: objectives.value,
    records: emptyRecords(start.treasury),
    log: [],
    currentMatch: null,
    finance: { lastWeek: null, season: emptyReport() },
    alerts: [],
    offseason: null,
    effects: [],
    gameOver: null,
    cup: cup.value,
    staff: { physio: false, scout: false, analyst: false },
  };
}

export type Action =
  | { type: 'setAlwaysLiveMatches'; value: boolean }
  | { type: 'setFormation'; formation: Formation }
  | { type: 'setStyle'; style: PlayStyle }
  | { type: 'setAutoLineup'; value: boolean }
  | { type: 'swapPlayers'; a: string; b: string }
  | { type: 'placePlayer'; slot: number; playerId: string }
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
  | { type: 'startSeason' }
  | { type: 'resolveEvent'; choiceId: string }
  | { type: 'markExported' }
  | { type: 'setTicketPrice'; factor: number }
  | { type: 'answerRaise'; playerId: string; accept: boolean }
  | { type: 'setStaff'; role: StaffRole; hired: boolean }
  | { type: 'addPlayTime'; seconds: number };

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
    case 'placePlayer': {
      const player = state.squad.players.find((p) => p.id === action.playerId);
      if (!player || player.injuryWeeks > 0 || player.contractYears <= 0) return state;
      if (action.slot < 0 || action.slot >= state.squad.lineup.length) return state;
      const lineup = state.squad.lineup.map((id) => (id === action.playerId ? '' : id));
      lineup[action.slot] = action.playerId;
      return { ...state, squad: { ...state.squad, autoLineup: false, lineup } };
    }
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
      return recordOtherMoney(state, buyPlayer(state, action.playerId));
    case 'sellPlayer':
      return recordOtherMoney(state, sellPlayer(state, action.playerId));
    case 'startSeason':
      return startSeason(state);
    case 'setTicketPrice':
      return { ...state, club: { ...state.club, ticketPriceFactor: clampTicketFactor(action.factor) } };
    case 'setStaff':
      return { ...state, staff: { ...state.staff, [action.role]: action.hired } };
    case 'answerRaise':
      return answerRaise(state, action.playerId, action.accept);
    case 'markExported':
      return { ...state, meta: { ...state.meta, lastExport: { season: state.time.season, week: state.time.week } } };
    case 'addPlayTime': {
      if (!(action.seconds > 0)) return state;
      const t = state.meta.playTime;
      return {
        ...state,
        meta: { ...state.meta, playTime: { ...t, total: t.total + action.seconds, season: t.season + action.seconds } },
      };
    }
    case 'resolveEvent':
      return recordOtherMoney(state, resolveEvent(state, action.choiceId));
  }
}
