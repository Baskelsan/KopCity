import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { autoLineup, benchOf } from '../src/core/lineup';
import {
  clubOutcome,
  createMatch,
  decide,
  defaultDecision,
  runMatch,
  simulateToEnd,
  type ClubContext,
} from '../src/core/match';
import type { MatchState } from '../src/core/matchTypes';
import { generateSquad } from '../src/core/players';
import { seedToState } from '../src/core/rng';
import type { Player, TeamStrength } from '../src/core/state';
import { applyModifiers, generateOpponent, lineupStrength } from '../src/core/strength';

const M = balance.match;
const S = balance.strength;
const squad = generateSquad(seedToState(77), 10).value;
const ctx: ClubContext = { players: squad, formation: '4-4-2' };
const lineup = autoLineup(squad, '4-4-2');
const opponent = generateOpponent(seedToState(5), 10, 'o').value;

function newMatch(seed: number, overrides: Partial<{ players: Player[]; opponent: TeamStrength }> = {}): MatchState {
  const players = overrides.players ?? squad;
  const onField = autoLineup(players, '4-4-2');
  return createMatch({
    seed,
    live: false,
    home: { name: 'Club', strength: null },
    away: { name: opponent.name, strength: overrides.opponent ?? opponent.strength },
    clubSide: 'home',
    onField,
    bench: benchOf(players, onField),
    style: 'balanced',
  });
}

/** Rejoue un match en direct en appliquant à chaque arrêt la décision donnée par `choose`. */
function playLive(match: MatchState, choose: (m: MatchState) => Parameters<typeof decide>[1], c = ctx): MatchState {
  let s = runMatch(match, c);
  while (!s.finished) s = decide(s, choose(s), c);
  return s;
}

describe('forces', () => {
  const base = lineupStrength(squad, '4-4-2', lineup);
  const neutral = { style: 'balanced' as const, late: 'keep' as const, morale: 50, home: false };

  it('additionnent les lignes, le milieu soutenant attaque et défense', () => {
    expect(base.att).toBeGreaterThan(0);
    expect(base.def).toBeGreaterThan(base.att);
    expect(base.gk).toBeGreaterThan(0);
  });

  it('une formation à 3 attaquants attaque plus qu’une formation à 1', () => {
    const f433 = lineupStrength(squad, '4-3-3', autoLineup(squad, '4-3-3'));
    const f4231 = lineupStrength(squad, '4-2-3-1', autoLineup(squad, '4-2-3-1'));
    expect(f433.att).toBeGreaterThan(f4231.att);
    expect(f4231.mid).toBeGreaterThan(f433.mid);
  });

  it('une place vide affaiblit l’équipe', () => {
    const withHole = [...lineup];
    withHole[10] = '';
    expect(lineupStrength(squad, '4-4-2', withHole).att).toBeLessThan(base.att);
  });

  it('le style déplace de la force entre défense et attaque', () => {
    const off = applyModifiers(base, { ...neutral, style: 'offensive' });
    expect(off.att).toBeCloseTo(base.att * (1 + S.styleShift.offensive));
    expect(off.def).toBeCloseTo(base.def * (1 - S.styleShift.offensive));
    const def = applyModifiers(base, { ...neutral, style: 'defensive' });
    expect(def.def).toBeGreaterThan(base.def);
    expect(def.att).toBeLessThan(base.att);
  });

  it('le moral et le terrain jouent sur toutes les lignes', () => {
    expect(applyModifiers(base, neutral)).toEqual(base);
    const happy = applyModifiers(base, { ...neutral, morale: 100 });
    expect(happy.mid).toBeCloseTo(base.mid * (1 + S.moraleEffect));
    const sad = applyModifiers(base, { ...neutral, morale: 0 });
    expect(sad.mid).toBeCloseTo(base.mid * (1 - S.moraleEffect));
    const home = applyModifiers(base, { ...neutral, home: true });
    expect(home.gk).toBeCloseTo(base.gk * (1 + S.homeAdvantage));
  });

  it('l’adversaire généré a une force sur la même échelle que le club', () => {
    expect(opponent.strength.mid / base.mid).toBeGreaterThan(0.6);
    expect(opponent.strength.mid / base.mid).toBeLessThan(1.6);
  });
});

describe('simulation du match', () => {
  it('même graine, même match', () => {
    expect(simulateToEnd(newMatch(42), ctx)).toEqual(simulateToEnd(newMatch(42), ctx));
  });

  it('graines différentes, matchs différents', () => {
    const a = simulateToEnd(newMatch(1), ctx);
    const b = simulateToEnd(newMatch(2), ctx);
    expect(a.events).not.toEqual(b.events);
  });

  it('le direct sans rien changer donne exactement le résumé', () => {
    for (let seed = 0; seed < 50; seed++) {
      const summary = simulateToEnd(newMatch(seed), ctx);
      const live = playLive({ ...newMatch(seed), live: true }, (m) => defaultDecision(m, ctx));
      expect({ ...live, live: false }).toEqual(summary);
    }
  });

  it('un autre choix peut changer la suite du match', () => {
    let changed = 0;
    for (let seed = 0; seed < 50; seed++) {
      const summary = simulateToEnd(newMatch(seed), ctx);
      const forced = playLive(newMatch(seed), (m) =>
        m.pending[0]?.type === 'late' ? { type: 'late', choice: 'force' } : defaultDecision(m, ctx),
      );
      if (forced.score.home !== summary.score.home || forced.score.away !== summary.score.away) changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('tire entre 8 et 15 occasions', () => {
    for (let seed = 0; seed < 300; seed++) {
      const count = simulateToEnd(newMatch(seed), ctx).events.filter((e) => e.type === 'chance').length;
      expect(count).toBeGreaterThanOrEqual(M.chancesMin);
      expect(count).toBeLessThanOrEqual(M.chancesMax);
    }
  });

  it('le score correspond aux buts du fil', () => {
    const m = simulateToEnd(newMatch(9), ctx);
    const goals = (side: string) =>
      m.events.filter((e) => e.type === 'chance' && e.outcome === 'goal' && e.side === side).length;
    expect(m.score).toEqual({ home: goals('home'), away: goals('away') });
  });

  it('s’arrête à la mi-temps puis vers la 70e minute', () => {
    let s = runMatch(newMatch(3), ctx);
    const stops: string[] = [];
    while (!s.finished) {
      const pending = s.pending[0]!;
      stops.push(`${pending.type}@${s.minute}`);
      s = decide(s, defaultDecision(s, ctx), ctx);
    }
    expect(stops.filter((x) => x.startsWith('halftime'))).toEqual([`halftime@${M.halftimeMinute}`]);
    expect(stops.filter((x) => x.startsWith('late'))).toEqual([`late@${M.lateDecisionMinute}`]);
    expect(s.minute).toBe(M.fullTimeMinute);
  });

  it('une blessure du club demande un remplaçant, qui entre en jeu', () => {
    let found = false;
    for (let seed = 0; seed < 400 && !found; seed++) {
      let s = runMatch(newMatch(seed), ctx);
      while (!s.finished) {
        const pending = s.pending[0]!;
        if (pending.type === 'injury') {
          const decision = defaultDecision(s, ctx);
          s = decide(s, decision, ctx);
          if (decision.type === 'injury' && decision.replacementId) {
            expect(s.club.onField).toContain(decision.replacementId);
            expect(s.club.onField).not.toContain(pending.playerId);
            expect(s.club.played).toContain(decision.replacementId);
            expect(s.injuries.map((i) => i.playerId)).toContain(pending.playerId);
            found = true;
          }
        } else {
          s = decide(s, defaultDecision(s, ctx), ctx);
        }
      }
    }
    expect(found).toBe(true);
  });

  it('refuse une décision qui ne correspond pas à l’arrêt en cours', () => {
    const s = runMatch(newMatch(4), ctx);
    expect(() => decide(s, { type: 'late', choice: 'force' }, ctx)).toThrow();
  });

  it('l’équipe la plus forte gagne souvent, mais pas toujours', () => {
    const strong = squad.map((p) => ({
      ...p,
      stats: { att: p.stats.att + 3, def: p.stats.def + 3, pas: p.stats.pas + 3, phy: p.stats.phy + 3 },
    }));
    const strongCtx = { players: strong, formation: '4-4-2' as const };
    const runs = 1000;
    let wins = 0;
    let losses = 0;
    for (let seed = 0; seed < runs; seed++) {
      const result = clubOutcome(simulateToEnd(newMatch(seed, { players: strong }), strongCtx));
      if (result === 'win') wins++;
      if (result === 'loss') losses++;
    }
    expect(wins / runs).toBeGreaterThan(0.6);
    expect(wins / runs).toBeLessThan(0.95);
    expect(losses).toBeGreaterThan(0);
  });

  it('produit un nombre de buts réaliste en moyenne', () => {
    let goals = 0;
    const runs = 1000;
    for (let seed = 0; seed < runs; seed++) {
      const m = simulateToEnd(newMatch(seed), ctx);
      goals += m.score.home + m.score.away;
    }
    expect(goals / runs).toBeGreaterThan(1.8);
    expect(goals / runs).toBeLessThan(3.6);
  });

  it('reste sérialisable en JSON à chaque arrêt', () => {
    const s = runMatch(newMatch(8), ctx);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
