// Événements : tirés au début d'une semaine parmi ceux dont la condition est remplie,
// ils proposent 2 choix dont les effets sont décrits par les données (src/data/events.json).
import balance from '../data/balance.json';
import eventsData from '../data/events.json';
import { academyLevel, builtBuildings, stadiumCapacity } from './city';
import { myDivision, myForm, rankOf } from './league';
import { autoLineup } from './lineup';
import { contractedPlayers, generateProspects } from './offseason';
import { divisionLevel, overall, transferValue } from './players';
import { nextChance, nextInt, pick, type Draw } from './rng';
import {
  MY_TEAM_ID,
  type ActiveEffect,
  type BuildingType,
  type GameState,
  type LogEntry,
  type PendingEvent,
  type Player,
  type Squad,
} from './state';

export type EventEffect =
  | { type: 'treasury'; amount: number }
  | { type: 'satisfaction'; amount: number }
  | { type: 'moraleAll'; amount: number }
  | { type: 'moraleTarget'; amount: number }
  | { type: 'supporters'; points: number }
  | { type: 'injureTarget'; weeksMin: number; weeksMax: number }
  | { type: 'injureRandom'; weeksMin: number; weeksMax: number }
  | { type: 'sellTarget'; valueFactor: number }
  | { type: 'signProdigy'; potentialBonus: number }
  | { type: 'homeStrength'; factor: number; matches: number }
  | { type: 'attendance'; factor: number; matches: number }
  | { type: 'sponsorBonus'; perWeek: number; weeks: number }
  | { type: 'commitTransport'; repay: number; satisfaction: number }
  | { type: 'risk'; chance: number; effects: EventEffect[] };

export type EventCondition =
  | { type: 'random' }
  | { type: 'satisfactionBelow'; value: number }
  | { type: 'rankAtMost'; value: number }
  | { type: 'playerAboveDivision'; margin: number }
  | { type: 'winStreak'; value: number }
  | { type: 'lossStreak'; value: number }
  | { type: 'academyLevelAtLeast'; value: number }
  | { type: 'averageMoraleBelow'; value: number }
  | { type: 'hasBuilding'; building: BuildingType }
  | { type: 'capacityAbove'; value: number };

export interface EventChoice {
  id: string;
  effects: EventEffect[];
}

export interface EventSpec {
  id: string;
  condition: EventCondition;
  target?: 'bestStarter' | 'bestPlayer';
  choices: EventChoice[];
}

export const EVENTS = eventsData as EventSpec[];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function eventSpec(id: string): EventSpec {
  const spec = EVENTS.find((e) => e.id === id);
  if (!spec) throw new Error(`Événement inconnu : ${id}`);
  return spec;
}

// ——— Conditions ———

/** Meilleur titulaire disponible (star blessée). */
function bestStarter(state: GameState): Player | undefined {
  const lineup = new Set(state.squad.lineup);
  return contractedPlayers(state.squad.players)
    .filter((p) => lineup.has(p.id) && p.injuryWeeks <= 0)
    .sort((a, b) => overall(b) - overall(a))[0];
}

/** Meilleur joueur, s'il dépasse nettement le niveau de la division (offre pour un joueur). */
function bestPlayerAbove(state: GameState, margin: number): Player | undefined {
  const best = contractedPlayers(state.squad.players).sort((a, b) => overall(b) - overall(a))[0];
  return best && overall(best) >= divisionLevel(state.league.myDivision) + margin ? best : undefined;
}

function streak(state: GameState, result: 'W' | 'L'): number {
  const form = myForm(myDivision(state.league));
  let count = 0;
  for (let i = form.length - 1; i >= 0 && form[i] === result; i--) count++;
  return count;
}

export function averageMorale(state: GameState): number {
  const players = contractedPlayers(state.squad.players);
  return players.length ? players.reduce((sum, p) => sum + p.morale, 0) / players.length : 50;
}

/** Joueur visé par l'événement, s'il en faut un ; undefined si l'événement ne peut pas avoir lieu. */
function eventTarget(state: GameState, spec: EventSpec): Player | null | undefined {
  if (spec.target === 'bestStarter') return bestStarter(state);
  if (spec.target === 'bestPlayer' && spec.condition.type === 'playerAboveDivision') {
    return bestPlayerAbove(state, spec.condition.margin);
  }
  return null;
}

export function isEligible(state: GameState, spec: EventSpec): boolean {
  const c = spec.condition;
  const division = myDivision(state.league);
  const started = division.table.some((r) => r.played > 0);
  let ok: boolean;
  switch (c.type) {
    case 'random':
      ok = true;
      break;
    case 'satisfactionBelow':
      ok = state.city.residentSatisfaction < c.value;
      break;
    case 'rankAtMost':
      ok = started && rankOf(division.table, MY_TEAM_ID) <= c.value;
      break;
    case 'playerAboveDivision':
      ok = bestPlayerAbove(state, c.margin) !== undefined;
      break;
    case 'winStreak':
      ok = streak(state, 'W') >= c.value;
      break;
    case 'lossStreak':
      ok = streak(state, 'L') >= c.value;
      break;
    case 'academyLevelAtLeast':
      ok = academyLevel(state.city) >= c.value;
      break;
    case 'averageMoraleBelow':
      ok = averageMorale(state) < c.value;
      break;
    case 'hasBuilding':
      ok = builtBuildings(state.city).some((b) => b.type === c.building);
      break;
    case 'capacityAbove':
      ok = stadiumCapacity(state.city) > c.value;
      break;
  }
  return ok && eventTarget(state, spec) !== undefined;
}

// ——— Déclenchement ———

/** Prépare l'événement : joueur visé, prix proposé, jeune prodige. */
export function prepareEvent(state: GameState, spec: EventSpec, rngState: number): Draw<PendingEvent> {
  let rng = rngState;
  const target = eventTarget(state, spec) ?? null;
  const effects = spec.choices.flatMap((c) => c.effects);
  const sell = effects.find((e): e is Extract<EventEffect, { type: 'sellTarget' }> => e.type === 'sellTarget');
  const prodigyEffect = effects.find((e): e is Extract<EventEffect, { type: 'signProdigy' }> => e.type === 'signProdigy');
  let prodigy: Player | null = null;
  if (prodigyEffect) {
    const level = academyLevel(state.city);
    const draw = generateProspects(rng, level, state.city.population, prodigyEffect.potentialBonus, 1);
    rng = draw.rngState;
    prodigy = draw.value[0] ?? null;
  }
  return {
    value: {
      eventId: spec.id,
      targetPlayerId: target?.id ?? null,
      offerPrice: sell && target ? Math.round(transferValue(target) * sell.valueFactor) : 0,
      prodigy,
    },
    rngState: rng,
  };
}

/**
 * Tirage de la semaine : à partir de la 3e semaine, une fois par semaine, une chance sur trois,
 * parmi les événements dont la condition est remplie (pas deux fois de suite le même).
 */
export function rollEvent(state: GameState): GameState {
  const { season, week } = state.time;
  const E = balance.events;
  const last = state.events.lastRoll;
  if (state.events.pending || week < E.firstWeek || (last && last.season === season && last.week === week)) return state;

  let rng = state.meta.rngState;
  const chance = nextChance(rng, E.weeklyChance);
  rng = chance.rngState;
  let pending: PendingEvent | null = null;
  if (chance.value) {
    const previous = state.events.history.at(-1)?.eventId;
    const eligible = EVENTS.filter((e) => isEligible(state, e) && !(E.noRepeat && e.id === previous));
    if (eligible.length > 0) {
      const chosen = pick(rng, eligible);
      const prepared = prepareEvent(state, chosen.value, chosen.rngState);
      rng = prepared.rngState;
      pending = prepared.value;
    }
  }
  return {
    ...state,
    meta: { ...state.meta, rngState: rng },
    events: { ...state.events, pending, lastRoll: { season, week } },
  };
}

/** Force un événement (tests, et événements déclenchés par la partie). */
export function triggerEvent(state: GameState, eventId: string): GameState {
  const prepared = prepareEvent(state, eventSpec(eventId), state.meta.rngState);
  return {
    ...state,
    meta: { ...state.meta, rngState: prepared.rngState },
    events: { ...state.events, pending: prepared.value },
  };
}

// ——— Choix ———

export type ChoiceRefusal = 'notEnoughMoney' | 'squadFull' | 'squadTooSmall';

/** Un choix est refusé s'il coûte plus que la trésorerie, ou s'il est impossible pour l'effectif. */
export function choiceRefusal(state: GameState, choice: EventChoice): ChoiceRefusal | null {
  const cost = choice.effects.reduce((sum, e) => sum + (e.type === 'treasury' && e.amount < 0 ? -e.amount : 0), 0);
  if (cost > 0 && state.club.treasury - cost < 0) return 'notEnoughMoney';
  const size = contractedPlayers(state.squad.players).length;
  if (choice.effects.some((e) => e.type === 'signProdigy') && size >= balance.squadSize.max) return 'squadFull';
  if (choice.effects.some((e) => e.type === 'sellTarget') && size <= balance.squadSize.min) return 'squadTooSmall';
  return null;
}

function withSquad(state: GameState, players: Player[]): Squad {
  const squad = { ...state.squad, players };
  if (squad.autoLineup) return { ...squad, lineup: autoLineup(contractedPlayers(players), squad.formation) };
  const ids = new Set(players.filter((p) => p.injuryWeeks <= 0).map((p) => p.id));
  return { ...squad, lineup: squad.lineup.map((id) => (ids.has(id) ? id : '')) };
}

interface Applied {
  state: GameState;
  /** 1 si un risque s'est réalisé, 0 s'il a été évité, absent sans risque. */
  riskHit?: number;
  injuredId?: string;
  weeks?: number;
}

function applyEffect(input: Applied, effect: EventEffect, pending: PendingEvent): Applied {
  let s = input.state;
  let rng = s.meta.rngState;
  const result: Applied = { ...input };
  const sup = balance.supporters;
  const morale = balance.morale;
  const transportCount = () =>
    builtBuildings(s.city).filter((b) => b.type === 'transport').length +
    s.city.constructions.filter((c) => c.type === 'transport').length;

  switch (effect.type) {
    case 'treasury':
      s = { ...s, club: { ...s.club, treasury: s.club.treasury + effect.amount } };
      break;
    case 'satisfaction':
      s = { ...s, city: { ...s.city, residentSatisfaction: clamp(s.city.residentSatisfaction + effect.amount, 0, 100) } };
      break;
    case 'moraleAll':
    case 'moraleTarget': {
      const players = s.squad.players.map((p) =>
        effect.type === 'moraleAll' || p.id === pending.targetPlayerId
          ? { ...p, morale: clamp(p.morale + effect.amount, morale.min, morale.max) }
          : p,
      );
      s = { ...s, squad: { ...s.squad, players } };
      break;
    }
    case 'supporters':
      s = {
        ...s,
        city: { ...s.city, supporterShare: clamp(s.city.supporterShare + effect.points / 100, sup.min, sup.max) },
      };
      break;
    case 'injureTarget':
    case 'injureRandom': {
      let targetId = pending.targetPlayerId;
      if (effect.type === 'injureRandom') {
        const candidates = contractedPlayers(s.squad.players).filter((p) => p.injuryWeeks <= 0);
        if (candidates.length === 0) break;
        const chosen = pick(rng, candidates);
        rng = chosen.rngState;
        targetId = chosen.value.id;
      }
      const weeks = nextInt(rng, effect.weeksMin, effect.weeksMax);
      rng = weeks.rngState;
      const players = s.squad.players.map((p) =>
        p.id === targetId ? { ...p, injuryWeeks: Math.max(p.injuryWeeks, weeks.value) } : p,
      );
      s = { ...s, meta: { ...s.meta, rngState: rng }, squad: withSquad(s, players) };
      result.injuredId = targetId ?? undefined;
      result.weeks = weeks.value;
      break;
    }
    case 'sellTarget': {
      const players = s.squad.players.filter((p) => p.id !== pending.targetPlayerId);
      s = { ...s, club: { ...s.club, treasury: s.club.treasury + pending.offerPrice }, squad: withSquad(s, players) };
      break;
    }
    case 'signProdigy':
      if (pending.prodigy) s = { ...s, squad: withSquad(s, [...s.squad.players, pending.prodigy]) };
      break;
    case 'homeStrength':
    case 'attendance':
      s = { ...s, effects: [...s.effects, { kind: effect.type, factor: effect.factor, matchesLeft: effect.matches }] };
      break;
    case 'sponsorBonus':
      s = { ...s, effects: [...s.effects, { kind: 'sponsorBonus', perWeek: effect.perWeek, weeksLeft: effect.weeks }] };
      break;
    case 'commitTransport': {
      const commitment: ActiveEffect = {
        kind: 'commitTransport',
        season: s.time.season,
        transportsAtStart: transportCount(),
        repay: effect.repay,
        satisfaction: effect.satisfaction,
      };
      s = { ...s, effects: [...s.effects, commitment] };
      break;
    }
    case 'risk': {
      const roll = nextChance(rng, effect.chance);
      s = { ...s, meta: { ...s.meta, rngState: roll.rngState } };
      result.riskHit = roll.value ? 1 : 0;
      if (roll.value) {
        let inner: Applied = { state: s };
        for (const e of effect.effects) inner = applyEffect(inner, e, pending);
        return { ...result, ...inner, riskHit: 1 };
      }
      return { ...result, state: s };
    }
  }
  return { ...result, state: s };
}

/** Applique le choix fait pour l'événement en cours. */
export function resolveEvent(state: GameState, choiceId: string): GameState {
  const pending = state.events.pending;
  if (!pending) return state;
  const choice = eventSpec(pending.eventId).choices.find((c) => c.id === choiceId);
  if (!choice || choiceRefusal(state, choice)) return state;

  let applied: Applied = { state };
  for (const effect of choice.effects) applied = applyEffect(applied, effect, pending);
  const s = applied.state;
  const at = { season: s.time.season, week: s.time.week };
  const params: Record<string, string | number> = { eventId: pending.eventId, choiceId };
  if (applied.riskHit !== undefined) params.riskHit = applied.riskHit;
  if (applied.injuredId) {
    params.playerId = applied.injuredId;
    params.weeks = applied.weeks ?? 0;
  }
  const entry: LogEntry = { ...at, key: 'eventResolved', params };
  return {
    ...s,
    events: { ...s.events, pending: null, history: [...s.events.history, { eventId: pending.eventId, choiceId, ...at }] },
    log: [...s.log, entry],
    alerts: [{ key: 'eventOutcome', params }],
  };
}

// ——— Engagements ———

/** Fin de saison : l'engagement de construire un transport est tenu, ou la subvention est remboursée. */
export function settleCommitments(state: GameState): { state: GameState; broken: number } {
  const count =
    builtBuildings(state.city).filter((b) => b.type === 'transport').length +
    state.city.constructions.filter((c) => c.type === 'transport').length;
  let s = state;
  let broken = 0;
  for (const e of state.effects) {
    if (e.kind !== 'commitTransport' || e.season !== state.time.season) continue;
    if (count > e.transportsAtStart) continue;
    broken++;
    s = {
      ...s,
      club: { ...s.club, treasury: s.club.treasury - e.repay },
      city: { ...s.city, residentSatisfaction: clamp(s.city.residentSatisfaction + e.satisfaction, 0, 100) },
    };
  }
  return { state: { ...s, effects: s.effects.filter((e) => e.kind !== 'commitTransport') }, broken };
}
