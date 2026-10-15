import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { applyAction, newGame, type Action } from '../src/core/game';
import { defaultDecision } from '../src/core/match';
import type { GameState } from '../src/core/state';

const fresh = () => newGame({ seed: 2024, now: '2026-10-15T10:00:00.000Z', clubName: 'FC Test' });
const run = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);

function playLiveToEnd(state: GameState): GameState {
  let s = run(state, { type: 'startFriendly', live: true });
  while (!s.currentMatch!.finished) {
    const ctx = { players: s.squad.players, formation: s.squad.formation };
    s = applyAction(s, { type: 'matchDecision', decision: defaultDecision(s.currentMatch!, ctx) });
  }
  return s;
}

describe('effectif : actions', () => {
  it('changer de formation recalcule la composition automatique', () => {
    const s = run(fresh(), { type: 'setFormation', formation: '4-3-3' });
    expect(s.squad.formation).toBe('4-3-3');
    const atts = s.squad.lineup.slice(8).map((id) => s.squad.players.find((p) => p.id === id)!.pos);
    expect(atts).toEqual(['ATT', 'ATT', 'ATT']);
  });

  it('un échange manuel coupe la composition automatique', () => {
    const s0 = fresh();
    const benchId = s0.squad.players.find((p) => !s0.squad.lineup.includes(p.id))!.id;
    const s = run(s0, { type: 'swapPlayers', a: s0.squad.lineup[5]!, b: benchId });
    expect(s.squad.autoLineup).toBe(false);
    expect(s.squad.lineup[5]).toBe(benchId);
    const back = run(s, { type: 'setAutoLineup', value: true });
    expect(back.squad.lineup).toEqual(s0.squad.lineup);
  });

  it('change le style', () => {
    expect(run(fresh(), { type: 'setStyle', style: 'defensive' }).squad.style).toBe('defensive');
  });
});

describe('match amical', () => {
  it('en résumé : le match est joué jusqu’au bout et sauvegardé dans l’état', () => {
    const s = run(fresh(), { type: 'startFriendly', live: false });
    expect(s.currentMatch?.finished).toBe(true);
    expect(s.meta.rngState).not.toBe(fresh().meta.rngState);
  });

  it('en direct : le match s’arrête à la première décision', () => {
    const s = run(fresh(), { type: 'startFriendly', live: true });
    expect(s.currentMatch?.finished).toBe(false);
    expect(s.currentMatch?.pending.length).toBeGreaterThan(0);
  });

  it('même partie, même match : en direct sans rien changer ou en résumé', () => {
    const summary = run(fresh(), { type: 'startFriendly', live: false }).currentMatch!;
    const live = playLiveToEnd(fresh()).currentMatch!;
    expect(live.score).toEqual(summary.score);
    expect(live.events).toEqual(summary.events);
  });

  it('on ne peut pas relancer un match déjà en cours', () => {
    const s = run(fresh(), { type: 'startFriendly', live: true });
    expect(run(s, { type: 'startFriendly', live: true })).toBe(s);
  });

  it('terminer applique le moral et les blessures, puis libère le match', () => {
    // On cherche une partie où le club a un blessé, pour vérifier aussi les blessures.
    for (let seed = 0; seed < 300; seed++) {
      const start = newGame({ seed, now: 'x', clubName: 'C' });
      const played = run(start, { type: 'startFriendly', live: false });
      const match = played.currentMatch!;
      if (match.injuries.length === 0) continue;

      const done = run(played, { type: 'finishMatch' });
      expect(done.currentMatch).toBeNull();
      const outcome = match.score[match.club.side] - match.score[match.club.side === 'home' ? 'away' : 'home'];
      const delta = outcome > 0 ? balance.morale.win : outcome < 0 ? balance.morale.loss : balance.morale.draw;
      for (const p of done.squad.players) {
        const before = start.squad.players.find((x) => x.id === p.id)!;
        const expected = match.club.played.includes(p.id) ? delta : balance.morale.notPlayed;
        expect(p.morale).toBe(before.morale + expected);
      }
      const injury = match.injuries[0]!;
      const injured = done.squad.players.find((p) => p.id === injury.playerId)!;
      expect(injured.injuryWeeks).toBe(injury.weeks);
      expect(done.squad.lineup).not.toContain(injury.playerId);
      return;
    }
    throw new Error('Aucune blessure trouvée');
  });

  it('un match fait passer une semaine pour les blessures en cours', () => {
    const s0 = fresh();
    const hurtId = s0.squad.players[0]!.id;
    const hurt: GameState = {
      ...s0,
      squad: { ...s0.squad, players: s0.squad.players.map((p) => (p.id === hurtId ? { ...p, injuryWeeks: 3 } : p)) },
    };
    const done = run(hurt, { type: 'startFriendly', live: false }, { type: 'finishMatch' });
    const after = done.squad.players.find((p) => p.id === hurtId)!;
    expect(after.injuryWeeks).toBeGreaterThanOrEqual(2);
    expect(after.injuryWeeks).toBeLessThanOrEqual(3);
  });

  it('terminer un match pas fini ne fait rien', () => {
    const s = run(fresh(), { type: 'startFriendly', live: true });
    expect(run(s, { type: 'finishMatch' })).toBe(s);
  });
});
