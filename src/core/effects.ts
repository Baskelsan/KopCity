// Effets temporaires laissés par les événements : lus par le match et l'économie, usés chaque semaine.
import balance from '../data/balance.json';
import type { ActiveEffect, GameState } from './state';

/** Multiplicateur de force du club pour un match à domicile (pelouse abîmée). */
export function homeStrengthFactor(state: GameState): number {
  return state.effects.reduce((f, e) => (e.kind === 'homeStrength' && e.matchesLeft > 0 ? f * e.factor : f), 1);
}

/** Multiplicateur d'affluence du prochain match à domicile (grève des transports). */
export function attendanceFactor(state: GameState): number {
  return state.effects.reduce((f, e) => (e.kind === 'attendance' && e.matchesLeft > 0 ? f * e.factor : f), 1);
}

/** Revenu de sponsor en plus chaque semaine (sponsor maillot). */
export function sponsorBonusPerWeek(state: GameState): number {
  return state.effects.reduce((sum, e) => (e.kind === 'sponsorBonus' && e.weeksLeft > 0 ? sum + e.perWeek : sum), 0);
}

/** Fin de semaine : les effets « par match à domicile » et « par semaine » s'usent. */
export function wearEffects(effects: readonly ActiveEffect[], homeMatch: boolean): ActiveEffect[] {
  return effects
    .map((e): ActiveEffect => {
      if ((e.kind === 'homeStrength' || e.kind === 'attendance') && homeMatch) return { ...e, matchesLeft: e.matchesLeft - 1 };
      if (e.kind === 'sponsorBonus') return { ...e, weeksLeft: e.weeksLeft - 1 };
      return e;
    })
    .filter((e) => !('matchesLeft' in e && e.matchesLeft <= 0) && !('weeksLeft' in e && e.weeksLeft <= 0));
}

/** Analyste vidéo : un peu plus de force à chaque match. */
export function staffStrengthFactor(state: GameState): number {
  return state.staff.analyst ? balance.staff.analyst.strengthFactor : 1;
}

/** Préparateur physique : blessures moins fréquentes et plus courtes. */
export function staffInjuryFactor(state: GameState): number {
  return state.staff.physio ? balance.staff.physio.injuryFactor : 1;
}
