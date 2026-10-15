// Simulation d'un match, en tranches : on simule jusqu'au prochain moment de décision, puis on attend le choix.
// Le nombre de tirages ne dépend jamais des choix : avec les choix par défaut, le direct et le résumé
// donnent exactement le même match. Avec d'autres choix, les mêmes tirages tombent sur d'autres probabilités.
import balance from '../data/balance.json';
import { formationSlots } from './lineup';
import { lineRating } from './players';
import { nextFloat, nextInt, seedToState } from './rng';
import type { Formation, Player, PlayStyle, Position, TeamStrength } from './state';
import { applyModifiers, averageMorale, lineupStrength } from './strength';
import type {
  ChanceOutcome,
  ClubInMatch,
  Decision,
  MatchPlan,
  MatchState,
  MatchTeam,
  Side,
} from './matchTypes';

const M = balance.match;

/** Le contexte du club nécessaire à la simulation (lu dans l'état de jeu, jamais copié dans le match). */
export interface ClubContext {
  players: readonly Player[];
  formation: Formation;
}

export interface NewMatchOptions {
  seed: number;
  live: boolean;
  home: MatchTeam;
  away: MatchTeam;
  clubSide: Side;
  onField: string[];
  bench: string[];
  style: PlayStyle;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const safe = (x: number) => Math.max(x, 0.01);
const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');

/** Tire le déroulé du match (minutes des occasions, cartons, blessures) au coup d'envoi. */
function drawPlan(rngState: number): { plan: MatchPlan; rngState: number } {
  let rng = rngState;
  const int = (min: number, max: number) => {
    const draw = nextInt(rng, min, max);
    rng = draw.rngState;
    return draw.value;
  };
  const float = () => {
    const draw = nextFloat(rng);
    rng = draw.rngState;
    return draw.value;
  };
  const side = (): Side => (float() < 0.5 ? 'home' : 'away');

  const chanceCount = int(M.chancesMin, M.chancesMax);
  const chanceMinutes = Array.from({ length: chanceCount }, () => int(1, M.fullTimeMinute)).sort((a, b) => a - b);

  const cardCount = int(0, M.cardsMax);
  const cards = Array.from({ length: cardCount }, () => ({ minute: int(1, M.fullTimeMinute), side: side() })).sort(
    (a, b) => a.minute - b.minute,
  );

  const injuries: MatchPlan['injuries'] = [];
  for (const injuredSide of ['home', 'away'] as const) {
    const happens = float() < M.injuryChancePerTeam;
    const minute = int(1, M.fullTimeMinute);
    const weeks = int(M.injuryWeeksMin, M.injuryWeeksMax);
    if (happens) injuries.push({ minute, side: injuredSide, weeks });
  }
  injuries.sort((a, b) => a.minute - b.minute);

  return { plan: { chanceMinutes, cards, injuries }, rngState: rng };
}

export function createMatch(options: NewMatchOptions): MatchState {
  const { plan, rngState } = drawPlan(seedToState(options.seed));
  return {
    seed: options.seed,
    rngState,
    live: options.live,
    home: options.home,
    away: options.away,
    club: {
      side: options.clubSide,
      onField: [...options.onField],
      bench: [...options.bench],
      played: options.onField.filter(Boolean),
      subsUsed: 0,
      style: options.style,
      late: 'keep',
    },
    plan,
    minute: 0,
    score: { home: 0, away: 0 },
    events: [],
    pending: [],
    halftimeDone: false,
    lateDone: false,
    finished: false,
    injuries: [],
  };
}

/** Forces actuelles d'un côté, avec style, choix de fin de match, moral et terrain. */
export function currentStrength(match: MatchState, side: Side, ctx: ClubContext): TeamStrength {
  const team = match[side];
  const home = side === 'home';
  if (team.strength) {
    return applyModifiers(team.strength, { style: 'balanced', late: 'keep', morale: 50, home });
  }
  const { onField, style, late } = match.club;
  const base = lineupStrength(ctx.players, ctx.formation, onField);
  return applyModifiers(base, { style, late, morale: averageMorale(ctx.players, onField), home });
}

/** Choisit un joueur du club sur le terrain avec un tirage dans [0, 1), pondéré par ligne. */
function pickOnField(club: ClubInMatch, formation: Formation, roll: number, weights?: Record<Position, number>): string | null {
  const slots = formationSlots(formation);
  const candidates = club.onField
    .map((id, index) => ({ id, weight: id ? (weights ? weights[slots[index] as Position] : 1) : 0 }))
    .filter((c) => c.weight > 0);
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) return null;
  let target = roll * total;
  for (const c of candidates) {
    target -= c.weight;
    if (target < 0) return c.id;
  }
  return candidates[candidates.length - 1]?.id ?? null;
}

function canSubstitute(club: ClubInMatch): boolean {
  return club.subsUsed < M.maxSubstitutions && club.bench.length > 0;
}

function simulateMinute(s: MatchState, minute: number, ctx: ClubContext): void {
  const float = () => {
    const draw = nextFloat(s.rngState);
    s.rngState = draw.rngState;
    return draw.value;
  };
  const clubSide = s.club.side;

  for (const card of s.plan.cards.filter((c) => c.minute === minute)) {
    const roll = float();
    const playerId = card.side === clubSide ? pickOnField(s.club, ctx.formation, roll) : null;
    s.events.push({ minute, type: 'card', side: card.side, playerId });
  }

  for (const injury of s.plan.injuries.filter((i) => i.minute === minute)) {
    const roll = float();
    if (injury.side !== clubSide) {
      s.events.push({ minute, type: 'injury', side: injury.side, playerId: null, weeks: injury.weeks });
      continue;
    }
    const playerId = pickOnField(s.club, ctx.formation, roll);
    if (!playerId) continue;
    const slot = s.club.onField.indexOf(playerId);
    s.club.onField[slot] = '';
    s.injuries.push({ playerId, weeks: injury.weeks });
    s.events.push({ minute, type: 'injury', side: clubSide, playerId, weeks: injury.weeks });
    if (canSubstitute(s.club)) s.pending.push({ type: 'injury', playerId, slot });
  }

  for (const chanceMinute of s.plan.chanceMinutes) {
    if (chanceMinute !== minute) continue;
    const home = currentStrength(s, 'home', ctx);
    const away = currentStrength(s, 'away', ctx);
    const ownerRoll = float();
    const targetRoll = float();
    const goalRoll = float();
    const scorerRoll = float();

    const midHome = Math.pow(safe(home.mid), M.midfieldExponent);
    const midAway = Math.pow(safe(away.mid), M.midfieldExponent);
    const side: Side = ownerRoll < midHome / (midHome + midAway) ? 'home' : 'away';
    const attack = side === 'home' ? home : away;
    const defense = side === 'home' ? away : home;

    const pTarget = sigmoid(M.onTargetBias + M.onTargetSlope * Math.log(safe(attack.att) / safe(defense.def * M.defenseScale)));
    const pGoal = sigmoid(M.goalBias + M.goalSlope * Math.log(safe(attack.att) / safe(defense.gk * M.goalkeeperScale)));
    const outcome: ChanceOutcome = targetRoll >= pTarget ? 'off' : goalRoll < pGoal ? 'goal' : 'saved';

    const playerId = side === clubSide ? pickOnField(s.club, ctx.formation, scorerRoll, M.scorerWeights) : null;
    if (outcome === 'goal') s.score[side] += 1;
    s.events.push({ minute, type: 'chance', side, outcome, playerId });
  }
}

/** Simule jusqu'au prochain moment de décision ou jusqu'à la fin du match. */
export function runMatch(match: MatchState, ctx: ClubContext): MatchState {
  const s = structuredClone(match);
  for (;;) {
    if (s.finished || s.pending.length > 0) return s;
    if (s.minute === M.halftimeMinute && !s.halftimeDone) {
      s.events.push({ minute: s.minute, type: 'halftime' });
      s.pending.push({ type: 'halftime' });
      return s;
    }
    if (s.minute === M.lateDecisionMinute && !s.lateDone) {
      s.pending.push({ type: 'late' });
      return s;
    }
    if (s.minute === M.fullTimeMinute) {
      s.events.push({ minute: s.minute, type: 'fulltime' });
      s.finished = true;
      return s;
    }
    s.minute += 1;
    simulateMinute(s, s.minute, ctx);
  }
}

/** Le choix appliqué quand on ne touche à rien (résumé) : ne rien changer, meilleur remplaçant si blessure. */
export function defaultDecision(match: MatchState, ctx: ClubContext): Decision {
  const pending = match.pending[0];
  if (!pending) throw new Error('Aucune décision en attente');
  switch (pending.type) {
    case 'halftime':
      return { type: 'halftime', style: match.club.style };
    case 'late':
      return { type: 'late', choice: 'keep' };
    case 'injury':
      return { type: 'injury', replacementId: bestReplacement(match, pending.slot, ctx) };
  }
}

/** Meilleur remplaçant pour une place donnée. */
export function bestReplacement(match: MatchState, slot: number, ctx: ClubContext): string | null {
  const line = formationSlots(ctx.formation)[slot] ?? 'MIL';
  const byId = new Map(ctx.players.map((p) => [p.id, p]));
  const options = match.club.bench
    .map((id) => byId.get(id))
    .filter((p): p is Player => p !== undefined)
    .sort((a, b) => lineRating(b, line) - lineRating(a, line));
  return options[0]?.id ?? null;
}

/** Applique la décision en attente, puis reprend la simulation. */
export function decide(match: MatchState, decision: Decision, ctx: ClubContext): MatchState {
  const pending = match.pending[0];
  if (!pending || pending.type !== decision.type) throw new Error('Décision inattendue');
  const s = structuredClone(match);
  s.pending.shift();
  const side = s.club.side;

  if (decision.type === 'halftime') {
    if (decision.style !== s.club.style) {
      s.club.style = decision.style;
      s.events.push({ minute: s.minute, type: 'styleChange', side, style: decision.style });
    }
    s.halftimeDone = true;
  } else if (decision.type === 'late') {
    s.club.late = decision.choice;
    if (decision.choice !== 'keep') s.events.push({ minute: s.minute, type: 'lateChoice', side, choice: decision.choice });
    s.lateDone = true;
  } else if (pending.type === 'injury') {
    const inId = decision.replacementId;
    if (inId && s.club.bench.includes(inId) && s.club.subsUsed < M.maxSubstitutions) {
      s.club.onField[pending.slot] = inId;
      s.club.bench = s.club.bench.filter((id) => id !== inId);
      s.club.played.push(inId);
      s.club.subsUsed += 1;
      s.events.push({ minute: s.minute, type: 'substitution', side, outId: pending.playerId, inId });
    }
  }
  return runMatch(s, ctx);
}

/** Joue le match jusqu'au bout avec les choix par défaut (mode résumé). */
export function simulateToEnd(match: MatchState, ctx: ClubContext): MatchState {
  let s = runMatch(match, ctx);
  while (!s.finished) {
    s = decide(s, defaultDecision(s, ctx), ctx);
  }
  return s;
}

export type MatchOutcome = 'win' | 'draw' | 'loss';

export function clubOutcome(match: MatchState): MatchOutcome {
  const mine = match.score[match.club.side];
  const theirs = match.score[other(match.club.side)];
  return mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
}
