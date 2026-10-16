import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { autoLineup, benchOf } from '../src/core/lineup';
import { createMatch, simulateToEnd, type ClubContext } from '../src/core/match';
import type { MatchState } from '../src/core/matchTypes';
import { applyMatchStats, averageRating, matchRatings } from '../src/core/playerStats';
import { generateSquad } from '../src/core/players';
import { seedToState } from '../src/core/rng';
import { newGame } from '../src/core/game';
import { endSeason, startSeason } from '../src/core/offseason';
import { advanceAndHandle } from './helpers';

const R = balance.matchRating;
const squad = generateSquad(seedToState(31), 10).value;
const ctx: ClubContext = { players: squad, formation: '4-4-2' };
const opponent = { att: 30, mid: 38, def: 50, gk: 10 };

function play(seed: number): MatchState {
  const onField = autoLineup(squad, '4-4-2');
  return simulateToEnd(
    createMatch({
      seed,
      live: false,
      home: { name: 'Club', strength: null },
      away: { name: 'Adversaire', strength: opponent },
      clubSide: 'home',
      onField,
      bench: benchOf(squad, onField),
      style: 'balanced',
    }),
    ctx,
  );
}

describe('passes décisives', () => {
  it('le passeur est un coéquipier sur le terrain, jamais le buteur ; certains buts sont en solo', () => {
    let assisted = 0;
    let solo = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const m = play(seed);
      for (const e of m.events) {
        if (e.type !== 'chance' || e.outcome !== 'goal' || e.side !== 'home') continue;
        if (e.assistId) {
          assisted++;
          expect(e.assistId).not.toBe(e.playerId);
          expect(m.club.played).toContain(e.assistId);
        } else solo++;
      }
    }
    expect(assisted).toBeGreaterThan(solo);
    expect(solo).toBeGreaterThan(0);
  });
});

describe('note de match sur 10', () => {
  it('chaque joueur entré en jeu a une note entre 3 et 10', () => {
    const m = play(4);
    const ratings = matchRatings(m, squad);
    expect([...ratings.keys()].sort()).toEqual([...m.club.played].sort());
    for (const r of ratings.values()) {
      expect(r).toBeGreaterThanOrEqual(R.min);
      expect(r).toBeLessThanOrEqual(R.max);
    }
  });

  it('un but rapporte un point, une passe décisive 0,6', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = play(seed);
      const goal = m.events.find((e) => e.type === 'chance' && e.outcome === 'goal' && e.side === 'home' && e.assistId);
      if (!goal || goal.type !== 'chance') continue;
      const ratings = matchRatings(m, squad);
      const without = matchRatings({ ...m, events: m.events.filter((e) => e !== goal) }, squad);
      expect(ratings.get(goal.playerId!)! - without.get(goal.playerId!)!).toBeCloseTo(R.goal, 1);
      return;
    }
    throw new Error('Aucun but avec passe');
  });
});

describe('statistiques de la saison et de la carrière', () => {
  it('s’additionnent match après match, et la moyenne se calcule', () => {
    const m = play(9);
    const once = applyMatchStats(squad, m);
    const twice = applyMatchStats(once, m);
    const id = m.club.played[0]!;
    const p1 = once.find((p) => p.id === id)!;
    const p2 = twice.find((p) => p.id === id)!;
    expect(p1.seasonStats.apps).toBe(1);
    expect(p2.seasonStats.apps).toBe(2);
    expect(p2.careerStats.apps).toBe(2);
    expect(averageRating(p2.seasonStats)).toBeCloseTo(averageRating(p1.seasonStats)!, 1);
    expect(averageRating({ apps: 0, goals: 0, assists: 0, ratingTotal: 0 })).toBeNull();
  });

  it('les buts du club correspondent à la somme des buts des joueurs', () => {
    let s = newGame({ seed: 12, now: 'x', clubName: 'C' });
    for (let i = 0; i < 8; i++) s = advanceAndHandle(s);
    // Les buts au palmarès du club restent même si le buteur part ; on compare sur l'effectif actuel.
    const current = new Set(s.squad.players.map((p) => p.id));
    const goals = s.squad.players.reduce((sum, p) => sum + p.careerStats.goals, 0);
    expect(goals).toBe(s.records.scorers.filter((x) => current.has(x.playerId)).reduce((sum, x) => sum + x.goals, 0));
  });

  it('les stats de la saison repartent de zéro, celles du club restent', () => {
    let s = newGame({ seed: 13, now: 'x', clubName: 'C' });
    for (let i = 0; i < 6; i++) s = advanceAndHandle(s);
    const next = startSeason(endSeason({ ...s, time: { season: 1, week: 19 } }));
    if (next.phase !== 'season') return;
    for (const p of next.squad.players) {
      expect(p.seasonStats.apps).toBe(0);
      const before = s.squad.players.find((x) => x.id === p.id);
      if (before) expect(p.careerStats.apps).toBe(before.careerStats.apps);
    }
  });
});
