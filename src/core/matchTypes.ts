// Types du match. Le match en cours est sauvegardé dans l'état, donc tout est sérialisable en JSON.
import type { PlayStyle, TeamStrength } from './state';

export type Side = 'home' | 'away';
export type LateChoice = 'keep' | 'force' | 'manage';
export type ChanceOutcome = 'off' | 'saved' | 'goal';

export type MatchEvent =
  | { minute: number; type: 'chance'; side: Side; outcome: ChanceOutcome; playerId: string | null }
  | { minute: number; type: 'card'; side: Side; playerId: string | null }
  | { minute: number; type: 'injury'; side: Side; playerId: string | null; weeks: number }
  | { minute: number; type: 'substitution'; side: Side; outId: string; inId: string }
  | { minute: number; type: 'styleChange'; side: Side; style: PlayStyle }
  | { minute: number; type: 'lateChoice'; side: Side; choice: LateChoice }
  | { minute: number; type: 'halftime' }
  | { minute: number; type: 'fulltime' };

export type PendingDecision =
  | { type: 'halftime' }
  | { type: 'late' }
  | { type: 'injury'; playerId: string; slot: number };

export type Decision =
  | { type: 'halftime'; style: PlayStyle }
  | { type: 'late'; choice: LateChoice }
  | { type: 'injury'; replacementId: string | null };

export interface MatchTeam {
  name: string;
  /** Force fixe pour une équipe adverse ; null pour le club, dont la force se recalcule à partir des joueurs. */
  strength: TeamStrength | null;
}

/** Ce que la graine a tiré au coup d'envoi : quand ont lieu les occasions, cartons et blessures. */
export interface MatchPlan {
  chanceMinutes: number[];
  cards: { minute: number; side: Side }[];
  injuries: { minute: number; side: Side; weeks: number }[];
}

export interface ClubInMatch {
  side: Side;
  /** Joueurs sur le terrain, place par place ('' = place vide). */
  onField: string[];
  bench: string[];
  /** Tous ceux qui sont entrés en jeu, pour le moral d'après-match. */
  played: string[];
  subsUsed: number;
  style: PlayStyle;
  late: LateChoice;
  /** Multiplicateur de force du club (pelouse abîmée…) (ajouté en v7). */
  strengthFactor: number;
}

export interface MatchState {
  /** Journée du championnat (ajouté en v4). */
  week: number;
  seed: number;
  rngState: number;
  /** true : affiché en minute par minute ; false : résumé. La simulation est identique. */
  live: boolean;
  home: MatchTeam;
  away: MatchTeam;
  club: ClubInMatch;
  plan: MatchPlan;
  /** Dernière minute simulée. */
  minute: number;
  score: { home: number; away: number };
  events: MatchEvent[];
  pending: PendingDecision[];
  halftimeDone: boolean;
  lateDone: boolean;
  finished: boolean;
  injuries: { playerId: string; weeks: number }[];
}
