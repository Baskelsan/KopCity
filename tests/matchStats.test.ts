import { describe, expect, it } from 'vitest';
import { applyAction, newGame } from '../src/core/game';
import type { GameState } from '../src/core/state';
import { midfieldShare, statsAt } from '../src/ui/MatchStats';

/** Une partie avec un match en direct en cours, joué jusqu'à la mi-temps. */
function liveAtHalftime(): GameState {
  return applyAction(applyAction(newGame({ seed: 3, now: 'x', clubName: 'C' }), { type: 'setAlwaysLiveMatches', value: true }), {
    type: 'advance',
  });
}

describe('statistiques du match en direct', () => {
  it('comptent occasions, tirs cadrés et cartons jusqu’à la minute affichée', () => {
    const s = liveAtHalftime();
    const match = s.currentMatch!;
    const full = statsAt(match, match.minute);
    const chances = match.events.filter((e) => e.type === 'chance');
    expect(full.home.chances + full.away.chances).toBe(chances.length);
    expect(full.home.onTarget + full.away.onTarget).toBe(chances.filter((e) => e.type === 'chance' && e.outcome !== 'off').length);
    const zero = statsAt(match, 0);
    expect(zero.home.chances + zero.away.chances).toBe(0);
  });

  it('la domination au milieu est une part entre 0 et 1', () => {
    const s = liveAtHalftime();
    const share = midfieldShare(s.currentMatch!, s);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
  });
});
