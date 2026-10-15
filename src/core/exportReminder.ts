// Rappel d'export : le stockage n'est pas garanti sur iOS, on invite à exporter régulièrement.
import balance from '../data/balance.json';
import type { GameState } from './state';

const weekIndex = (season: number, week: number) => (season - 1) * balance.league.seasonWeeks + week;

/** Semaines de jeu depuis le dernier export (ou depuis le début de la partie). */
export function weeksSinceExport(state: GameState): number {
  const last = state.meta.lastExport ?? { season: 1, week: 1 };
  return weekIndex(state.time.season, state.time.week) - weekIndex(last.season, last.week);
}

export function exportReminderDue(state: GameState): boolean {
  return state.phase !== 'gameOver' && weeksSinceExport(state) >= balance.exportReminderWeeks;
}
