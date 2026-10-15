// Objectifs de saison : un sportif, un financier, un urbain, tirés au début de chaque saison.
import objectivesData from '../data/objectives.json';
import { netResult } from './economy';
import { myDivision, rankOf } from './league';
import { pick, type Draw } from './rng';
import { MY_TEAM_ID, type DivisionId, type GameState, type Objective, type ObjectiveCategory, type ObjectiveResult } from './state';

interface ObjectiveSpec {
  id: string;
  type: string;
  value: number;
}

const DATA = objectivesData as {
  pools: Record<ObjectiveCategory, ObjectiveSpec[]>;
  reward: number;
  rewardDivisionFactor: Record<DivisionId, number>;
  allAchievedSponsorBonus: number;
};
const CATEGORIES: ObjectiveCategory[] = ['sport', 'finance', 'city'];

export function drawObjectives(rngState: number): Draw<Objective[]> {
  let rng = rngState;
  const objectives: Objective[] = [];
  for (const category of CATEGORIES) {
    const draw = pick(rng, DATA.pools[category]);
    rng = draw.rngState;
    objectives.push({ ...draw.value, category, achieved: false });
  }
  return { value: objectives, rngState: rng };
}

/** Plus longue série de matchs à domicile sans défaite cette saison. */
function homeUnbeatenStreak(state: GameState): number {
  let best = 0;
  let current = 0;
  const fixtures = myDivision(state.league)
    .fixtures.filter((f) => f.home === MY_TEAM_ID && f.result)
    .sort((a, b) => a.week - b.week);
  for (const f of fixtures) {
    current = f.result!.homeGoals >= f.result!.awayGoals ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

/** Objectifs acquis pour de bon dès qu'ils sont remplis ; les autres se jugent en fin de saison. */
export const SETTLED_EARLY = new Set(['homeUnbeatenStreak', 'buildingsDelivered']);

export interface ObjectiveProgress {
  current: number;
  target: number;
  done: boolean;
}

/** Où en est l'objectif (évalué définitivement en fin de saison). */
export function objectiveProgress(state: GameState, objective: Objective): ObjectiveProgress {
  const division = myDivision(state.league);
  switch (objective.type) {
    case 'rankAtMost': {
      const started = division.table.some((r) => r.played > 0);
      const rank = started ? rankOf(division.table, MY_TEAM_ID) : division.table.length;
      return { current: rank, target: objective.value, done: started && rank <= objective.value };
    }
    case 'homeUnbeatenStreak': {
      const streak = homeUnbeatenStreak(state);
      return { current: streak, target: objective.value, done: streak >= objective.value };
    }
    case 'treasuryAtLeast':
      return { current: state.club.treasury, target: objective.value, done: state.club.treasury >= objective.value };
    case 'seasonNetPositive': {
      const net = netResult(state.finance.season);
      return { current: net, target: 0, done: net > 0 };
    }
    case 'satisfactionAtLeast':
      return {
        current: state.city.residentSatisfaction,
        target: objective.value,
        done: state.city.residentSatisfaction >= objective.value,
      };
    case 'buildingsDelivered': {
      const delivered = state.log.filter(
        (e) => e.key === 'constructionDelivered' && e.season === state.time.season,
      ).length;
      return { current: delivered, target: objective.value, done: delivered >= objective.value };
    }
    default:
      return { current: 0, target: objective.value, done: false };
  }
}

/** Bilan de fin de saison : prime pour chaque objectif atteint (plus forte dans les divisions supérieures). */
export function evaluateObjectives(state: GameState, division: DivisionId): ObjectiveResult[] {
  return state.objectives.map((o) => {
    const done = objectiveProgress(state, o).done;
    return { id: o.id, achieved: done, reward: done ? Math.round(DATA.reward * DATA.rewardDivisionFactor[division]) : 0 };
  });
}

/** Tous les objectifs atteints : sponsors +10 % la saison suivante. */
export function sponsorMultiplierFor(results: readonly ObjectiveResult[]): number {
  return results.length > 0 && results.every((r) => r.achieved) ? 1 + DATA.allAchievedSponsorBonus : 1;
}
