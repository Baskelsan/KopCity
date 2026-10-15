// Rappel d'export : le stockage n'est pas garanti sur iOS, on invite à exporter à chaque fin de saison.
import balance from '../data/balance.json';
import type { GameState } from './state';

/** À l'intersaison, tant que la sauvegarde n'a pas été exportée depuis la fin de la saison. */
export function exportReminderDue(state: GameState): boolean {
  if (state.phase !== 'offseason') return false;
  const last = state.meta.lastExport;
  const exportedThisOffseason =
    last !== null && last.season === state.time.season && last.week > balance.league.seasonWeeks;
  return !exportedThisOffseason;
}
