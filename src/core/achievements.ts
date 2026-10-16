// Succès : des conditions sur l'état de la partie. Ils se débloquent pour de bon (gardés d'une partie à l'autre
// par la couche de stockage) dès que leur condition est remplie à un moment du jeu.
import achievementsData from '../data/achievements.json';
import { academyLevel } from './city';
import { myDivision, myForm } from './league';
import { MY_TEAM_ID, type GameState } from './state';

export interface AchievementSpec {
  id: string;
  type: string;
  value?: number | string;
}

export const ACHIEVEMENTS = achievementsData as AchievementSpec[];

/** Plus longue série de matchs de championnat sans défaite cette saison. */
function longestUnbeaten(state: GameState): number {
  let best = 0;
  let current = 0;
  for (const r of myForm(myDivision(state.league))) {
    current = r === 'L' ? 0 : current + 1;
    best = Math.max(best, current);
  }
  return best;
}

function wonInCup(state: GameState): boolean {
  return (state.cup?.rounds ?? []).some((round) =>
    round.ties.some((t) => (t.home === MY_TEAM_ID || t.away === MY_TEAM_ID) && t.result?.winner === MY_TEAM_ID),
  );
}

export function isMet(state: GameState, spec: AchievementSpec): boolean {
  const r = state.records;
  const n = typeof spec.value === 'number' ? spec.value : 0;
  switch (spec.type) {
    case 'anyWin':
      return myForm(myDivision(state.league)).includes('W') || wonInCup(state) || r.history.length > 0;
    case 'promotionsAtLeast':
      return r.promotions >= n;
    case 'titlesAtLeast':
      return r.titles.length >= n;
    case 'divisionReached':
      return state.league.myDivision === spec.value;
    case 'titleInDivision':
      return r.titles.some((t) => t.division === spec.value);
    case 'cupsAtLeast':
      return r.cups.length >= n;
    case 'giantKillingsAtLeast':
      return r.giantKillings >= n;
    case 'bestAttendanceAtLeast':
      return r.bestAttendance >= n;
    case 'bestTreasuryAtLeast':
      return r.bestTreasury >= n;
    case 'academyLevelAtLeast':
      return academyLevel(state.city) >= n;
    case 'allDistrictsUnlocked':
      return state.city.districts.every((d) => d.unlocked);
    case 'playerGoalsAtLeast':
      return r.scorers.some((s) => s.goals >= n);
    case 'unbeatenStreakAtLeast':
      return longestUnbeaten(state) >= n;
    case 'allObjectivesAchieved': {
      const results = state.offseason?.objectiveResults ?? [];
      return results.length > 0 && results.every((o) => o.achieved);
    }
    case 'redRecoveriesAtLeast':
      return r.redRecoveries >= n;
    default:
      return false;
  }
}

/** Identifiants des succès dont la condition est remplie maintenant. */
export function achievementsMet(state: GameState): string[] {
  return ACHIEVEMENTS.filter((a) => isMet(state, a)).map((a) => a.id);
}
