// Statistiques des joueurs : matchs, buts, passes décisives et note de match sur 10.
import balance from '../data/balance.json';
import { clubOutcome } from './match';
import type { MatchState } from './matchTypes';
import type { Player, PlayerSeasonStats } from './state';

const R = balance.matchRating;

export function emptyStats(): PlayerSeasonStats {
  return { apps: 0, goals: 0, assists: 0, ratingTotal: 0 };
}

/** Note moyenne sur 10 (null sans match joué). */
export function averageRating(stats: PlayerSeasonStats): number | null {
  return stats.apps > 0 ? Math.round((stats.ratingTotal / stats.apps) * 10) / 10 : null;
}

/**
 * Note de match de chaque joueur entré en jeu : base 6, résultat, buts, passes décisives, tirs,
 * et pour les gardiens et défenseurs, les buts encaissés.
 */
export function matchRatings(match: MatchState, players: readonly Player[]): Map<string, number> {
  const side = match.club.side;
  const conceded = match.score[side === 'home' ? 'away' : 'home'];
  const outcome = clubOutcome(match);
  const resultBonus = outcome === 'win' ? R.win : outcome === 'loss' ? R.loss : 0;
  const byId = new Map(players.map((p) => [p.id, p]));
  const ratings = new Map<string, number>();

  for (const id of match.club.played) {
    const player = byId.get(id);
    if (!player) continue;
    let rating = R.base + resultBonus;
    for (const e of match.events) {
      if (e.type !== 'chance' || e.side !== side) continue;
      if (e.playerId === id) rating += e.outcome === 'goal' ? R.goal : e.outcome === 'saved' ? R.shotOnTarget : R.shotOff;
      if (e.assistId === id) rating += R.assist;
    }
    if (player.pos === 'GAR' || player.pos === 'DEF') {
      rating += conceded === 0 ? R.cleanSheet : conceded * R.concededPerGoal;
    }
    ratings.set(id, Math.round(Math.min(R.max, Math.max(R.min, rating)) * 10) / 10);
  }
  return ratings;
}

function addMatch(stats: PlayerSeasonStats, rating: number, goals: number, assists: number): PlayerSeasonStats {
  return {
    apps: stats.apps + 1,
    goals: stats.goals + goals,
    assists: stats.assists + assists,
    ratingTotal: Math.round((stats.ratingTotal + rating) * 10) / 10,
  };
}

/** Ajoute le match aux statistiques de la saison et de la carrière au club. */
export function applyMatchStats(players: readonly Player[], match: MatchState): Player[] {
  const ratings = matchRatings(match, players);
  const side = match.club.side;
  return players.map((p) => {
    const rating = ratings.get(p.id);
    if (rating === undefined) return p;
    let goals = 0;
    let assists = 0;
    for (const e of match.events) {
      if (e.type !== 'chance' || e.side !== side || e.outcome !== 'goal') continue;
      if (e.playerId === p.id) goals++;
      if (e.assistId === p.id) assists++;
    }
    return {
      ...p,
      seasonStats: addMatch(p.seasonStats, rating, goals, assists),
      careerStats: addMatch(p.careerStats, rating, goals, assists),
    };
  });
}
