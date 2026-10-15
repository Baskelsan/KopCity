import balance from '../data/balance.json';
import { autoLineup, benchOf, effectiveLineup, swapInLineup } from './lineup';
import { clubOutcome, createMatch, decide, runMatch, simulateToEnd, type ClubContext } from './match';
import type { Decision, Side } from './matchTypes';
import { divisionLevel, generateSquad } from './players';
import { nextFloat, nextInt, seedToState } from './rng';
import {
  SCHEMA_VERSION,
  type DivisionId,
  type Formation,
  type GameState,
  type Player,
  type PlayStyle,
  type Squad,
} from './state';
import { generateOpponent } from './strength';

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
  const { squad, rngState } = startingSquad(
    seedToState(seed),
    division,
    start.formation as Formation,
    start.style as PlayStyle,
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { createdAt: now, lastSavedAt: now, seed, rngState },
    settings: { alwaysLiveMatches: false },
    time: { season: 1, week: 1 },
    club: {
      name: clubName,
      colors: clubColors ?? (start.clubColors as [string, string]),
      treasury: start.treasury,
      weeksInRed: 0,
    },
    squad,
    city: {
      stadiumLevel: start.stadiumLevel,
      population: start.population,
      supporterShare: start.supporterShare,
      residentSatisfaction: start.residentSatisfaction,
      districts: [],
      constructions: [],
    },
    league: { myDivision: division, divisions: [] },
    market: { offers: [] },
    events: { pending: null, history: [] },
    objectives: [],
    records: { titles: 0, promotions: 0, bestAttendance: 0, bestTreasury: start.treasury },
    log: [],
    currentMatch: null,
  };
}

export type Action =
  | { type: 'setAlwaysLiveMatches'; value: boolean }
  | { type: 'setFormation'; formation: Formation }
  | { type: 'setStyle'; style: PlayStyle }
  | { type: 'setAutoLineup'; value: boolean }
  | { type: 'swapPlayers'; a: string; b: string }
  | { type: 'startFriendly'; live: boolean }
  | { type: 'matchDecision'; decision: Decision }
  | { type: 'finishMatch' };

const clubContext = (state: GameState): ClubContext => ({
  players: state.squad.players,
  formation: state.squad.formation,
});

/** Recalcule la composition si elle est automatique. */
function refreshLineup(squad: Squad): Squad {
  return squad.autoLineup ? { ...squad, lineup: autoLineup(squad.players, squad.formation) } : squad;
}

/** Lance un match amical : graine et adversaire tirés du générateur de la partie, puis sauvegardés. */
function startFriendly(state: GameState, live: boolean): GameState {
  if (state.currentMatch) return state;
  let rng = state.meta.rngState;
  const seed = nextInt(rng, 0, 0xffffffff);
  rng = seed.rngState;
  const opponent = generateOpponent(rng, divisionLevel(state.league.myDivision), 'friendly');
  rng = opponent.rngState;
  const coin = nextFloat(rng);
  rng = coin.rngState;

  const { players, formation, lineup, style } = state.squad;
  const onField = effectiveLineup(players, formation, lineup);
  const clubSide: Side = coin.value < 0.5 ? 'home' : 'away';
  const clubTeam = { name: state.club.name, strength: null };
  const opponentTeam = { name: opponent.value.name, strength: opponent.value.strength };
  const ctx = clubContext(state);

  let match = createMatch({
    seed: seed.value,
    live,
    home: clubSide === 'home' ? clubTeam : opponentTeam,
    away: clubSide === 'home' ? opponentTeam : clubTeam,
    clubSide,
    onField,
    bench: benchOf(players, onField),
    style,
  });
  match = live ? runMatch(match, ctx) : simulateToEnd(match, ctx);
  return { ...state, meta: { ...state.meta, rngState: rng }, currentMatch: match };
}

/**
 * Applique les suites du match à l'effectif : un match compte comme une semaine pour les blessures en cours,
 * puis les nouvelles blessures et le moral (joueurs entrés en jeu selon le résultat, les autres baissent).
 */
function finishMatch(state: GameState): GameState {
  const match = state.currentMatch;
  if (!match?.finished) return state;
  const morale = balance.morale;
  const delta = morale[clubOutcome(match)];
  const played = new Set(match.club.played);
  const injuries = new Map(match.injuries.map((i) => [i.playerId, i.weeks]));

  const players = state.squad.players.map((p): Player => {
    const change = played.has(p.id) ? delta : morale.notPlayed;
    const healed = Math.max(0, p.injuryWeeks - 1);
    return {
      ...p,
      morale: Math.min(morale.max, Math.max(morale.min, p.morale + change)),
      injuryWeeks: Math.max(healed, injuries.get(p.id) ?? 0),
    };
  });
  return { ...state, squad: refreshLineup({ ...state.squad, players }), currentMatch: null };
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
    case 'startFriendly':
      return startFriendly(state, action.live);
    case 'matchDecision':
      if (!state.currentMatch || state.currentMatch.pending.length === 0) return state;
      return { ...state, currentMatch: decide(state.currentMatch, action.decision, clubContext(state)) };
    case 'finishMatch':
      return finishMatch(state);
  }
}
