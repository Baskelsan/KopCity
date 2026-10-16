// Palmarès et records du club, et bilan d'une partie terminée.
import type { MatchState } from './matchTypes';
import type { DivisionId, GameState, RecordKey, Records, ScorerRecord } from './state';

export function emptyRecords(treasury: number): Records {
  return {
    titles: [],
    promotions: 0,
    bestAttendance: 0,
    bestTreasury: treasury,
    scorers: [],
    history: [],
    cups: [],
    cupRuns: [],
    headToHead: {},
    redRecoveries: 0,
    giantKillings: 0,
    seasonStart: { bestAttendance: 0, bestTreasury: treasury, topScorer: null },
  };
}

/** Photographie des records au début d'une saison. */
export function markSeasonStart(records: Records): Records {
  return {
    ...records,
    seasonStart: {
      bestAttendance: records.bestAttendance,
      bestTreasury: records.bestTreasury,
      topScorer: topScorer(records) ?? null,
    },
  };
}

export function topScorer(records: Records): ScorerRecord | undefined {
  return [...records.scorers].sort((a, b) => b.goals - a.goals)[0];
}

/** Ajoute les buts du club marqués pendant le match. */
export function addGoals(records: Records, match: MatchState, names: Map<string, string>): Records {
  const scorers = records.scorers.map((s) => ({ ...s }));
  for (const event of match.events) {
    if (event.type !== 'chance' || event.outcome !== 'goal' || event.side !== match.club.side || !event.playerId) continue;
    const existing = scorers.find((s) => s.playerId === event.playerId);
    if (existing) existing.goals += 1;
    else scorers.push({ playerId: event.playerId, name: names.get(event.playerId) ?? '', goals: 1 });
  }
  return { ...records, scorers };
}

/** Ajoute un résultat au bilan face à un adversaire. */
export function addHeadToHead(records: Records, opponentId: string, scored: number, conceded: number): Records {
  const h = records.headToHead[opponentId] ?? { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  return {
    ...records,
    headToHead: {
      ...records.headToHead,
      [opponentId]: {
        played: h.played + 1,
        won: h.won + (scored > conceded ? 1 : 0),
        drawn: h.drawn + (scored === conceded ? 1 : 0),
        lost: h.lost + (scored < conceded ? 1 : 0),
        goalsFor: h.goalsFor + scored,
        goalsAgainst: h.goalsAgainst + conceded,
      },
    },
  };
}

/** Records battus depuis le début de la saison (signalés au bilan de fin de saison). */
export function beatenRecords(records: Records): RecordKey[] {
  const before = records.seasonStart;
  const beaten: RecordKey[] = [];
  if (records.bestAttendance > before.bestAttendance) beaten.push('bestAttendance');
  if (records.bestTreasury > before.bestTreasury) beaten.push('bestTreasury');
  const previousTop = before.topScorer;
  const newTop = topScorer(records);
  if (newTop && (!previousTop || (newTop.playerId !== previousTop.playerId && newTop.goals > previousTop.goals))) {
    beaten.push('topScorer');
  }
  return beaten;
}

/** Bilan d'une partie, gardé à part pour comparer ses parties successives. */
export interface GameSummary {
  clubName: string;
  startedAt: string;
  endedAt: string;
  seasons: number;
  titles: { season: number; division: DivisionId }[];
  promotions: number;
  bestDivision: DivisionId;
  bestAttendance: number;
  bestTreasury: number;
  topScorer: ScorerRecord | null;
}

const RANK: Record<DivisionId, number> = { D3: 1, D2: 2, D1: 3 };

export function gameSummary(state: GameState, endedAt: string): GameSummary {
  const divisions = [state.league.myDivision, ...state.records.history.map((h) => h.division)];
  const bestDivision = divisions.reduce((best, d) => (RANK[d] > RANK[best] ? d : best), divisions[0]!);
  return {
    clubName: state.club.name,
    startedAt: state.meta.createdAt,
    endedAt,
    seasons: state.time.season,
    titles: state.records.titles,
    promotions: state.records.promotions,
    bestDivision,
    bestAttendance: state.records.bestAttendance,
    bestTreasury: state.records.bestTreasury,
    topScorer: topScorer(state.records) ?? null,
  };
}
