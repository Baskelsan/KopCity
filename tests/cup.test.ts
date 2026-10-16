import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { cupByes, divisionOf, newCup, playCupRound } from '../src/core/cup';
import { applyAction, newGame } from '../src/core/game';
import { standings } from '../src/core/league';
import { endSeason, startSeason } from '../src/core/offseason';
import { seedToState } from '../src/core/rng';
import { MY_TEAM_ID, type GameState } from '../src/core/state';
import { advanceAndHandle, finishLiveMatch, resolvePendingEvent } from './helpers';

const C = balance.cup;
const RANK = { D3: 1, D2: 2, D1: 3 } as const;
const fresh = (seed = 5) => newGame({ seed, now: 'x', clubName: 'FC Test' });

/** Joue la saison jusqu'à la semaine donnée (matchs de coupe compris). */
function playUntilWeek(start: GameState, week: number): GameState {
  let s = start;
  for (let i = 0; i < 200 && s.phase === 'season' && s.time.week < week; i++) s = advanceAndHandle(s);
  return s;
}

describe('tirage', () => {
  it('30 clubs, 2 exemptés, 14 rencontres au 1er tour, chacun une seule fois', () => {
    const s = fresh();
    const cup = s.cup!;
    expect(cup.byes).toHaveLength(2);
    const round = cup.rounds[0]!;
    expect(round.ties).toHaveLength(14);
    expect(round.week).toBe(C.weeks[0]);
    const teams = round.ties.flatMap((t) => [t.home, t.away]);
    expect(new Set(teams).size).toBe(28);
    for (const bye of cup.byes) expect(teams).not.toContain(bye);
    expect(teams).toContain(MY_TEAM_ID);
  });

  it('les exemptés sont les deux plus forts de l’Élite en début de partie', () => {
    const s = fresh();
    const elite = s.league.divisions.find((d) => d.id === 'D1')!;
    const top = [...elite.teams].sort((a, b) => b.level - a.level).slice(0, 2).map((t) => t.id);
    expect(cupByes(s.league)).toEqual(top);
  });

  it('le club de la plus petite division reçoit', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = fresh(seed);
      for (const tie of s.cup!.rounds[0]!.ties) {
        expect(RANK[divisionOf(s.league, tie.home)]).toBeLessThanOrEqual(RANK[divisionOf(s.league, tie.away)]);
      }
    }
  });

  it('est déterministe', () => {
    const s = fresh();
    expect(newCup(seedToState(4), s.league, 1, [])).toEqual(newCup(seedToState(4), s.league, 1, []));
  });
});

describe('une coupe complète', () => {
  const end = playUntilWeek(fresh(8), C.weeks[4]! + 1);
  const cup = end.cup!;

  it('5 tours joués aux bonnes semaines : 14, 8, 4, 2 puis 1 rencontre', () => {
    expect(cup.rounds.map((r) => [r.round, r.week, r.ties.length, r.played])).toEqual([
      [1, 3, 14, true],
      [2, 7, 8, true],
      [3, 11, 4, true],
      [4, 15, 2, true],
      [5, 17, 1, true],
    ]);
    expect(cup.winner).toBe(cup.rounds[4]!.ties[0]!.result!.winner);
  });

  it('les exemptés entrent au 2e tour avec les 14 qualifiés', () => {
    const second = cup.rounds[1]!.ties.flatMap((t) => [t.home, t.away]);
    const qualified = cup.rounds[0]!.ties.map((t) => t.result!.winner);
    expect(second.sort()).toEqual([...qualified, ...cup.byes].sort());
  });

  it('une égalité se règle aux tirs au but, avec un vainqueur cohérent', () => {
    for (const round of cup.rounds) {
      for (const tie of round.ties) {
        const r = tie.result!;
        if (r.homeGoals === r.awayGoals) {
          expect(r.penalties).not.toBeNull();
          expect(r.penalties!.home).not.toBe(r.penalties!.away);
          expect(r.winner).toBe(r.penalties!.home > r.penalties!.away ? tie.home : tie.away);
        } else {
          expect(r.penalties).toBeNull();
          expect(r.winner).toBe(r.homeGoals > r.awayGoals ? tie.home : tie.away);
        }
      }
    }
  });

  it('le parcours du club est noté au palmarès', () => {
    const run = end.records.cupRuns.find((r) => r.season === 1);
    expect(run).toBeDefined();
    expect(run!.round).toBeGreaterThanOrEqual(1);
  });

  it('le championnat continue normalement : 18 journées', () => {
    const final = playUntilWeek(end, 19);
    expect(final.league.divisions.every((d) => d.table.every((r) => r.played === 18))).toBe(true);
  });
});

describe('le club en coupe', () => {
  it('passer un tour rapporte la prime ; à domicile, la billetterie en plus', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = playUntilWeek(fresh(seed), C.weeks[0]! + 1);
      const run = s.records.cupRuns.find((r) => r.season === 1);
      if (!run || run.round !== 1) continue;
      const first = s.cup!.rounds[0]!;
      const tie = first.ties.find((t) => t.home === MY_TEAM_ID || t.away === MY_TEAM_ID)!;
      if (tie.result!.winner !== MY_TEAM_ID) continue;
      expect(s.finance.season.income.cup).toBeGreaterThanOrEqual(C.prizes[0]!);
      return;
    }
    throw new Error('Aucune qualification trouvée');
  });

  it('à partir des quarts, le match de coupe se joue en direct', () => {
    for (let seed = 1; seed <= 80; seed++) {
      let s = fresh(seed);
      for (let i = 0; i < 200 && s.phase === 'season' && s.time.week <= C.weeks[2]!; i++) {
        s = applyAction(s, { type: 'advance' });
        if (s.events.pending) s = resolvePendingEvent(s);
        if (s.currentMatch?.competition === 'cup') {
          expect(s.currentMatch.cupRound).toBeGreaterThanOrEqual(C.liveFromRound);
          expect(s.alerts[0]).toMatchObject({ key: 'keyMatch', params: { reasons: 'cup' } });
          const done = finishLiveMatch(s);
          expect(done.currentMatch).toBeNull();
          expect(done.cup!.rounds.find((r) => r.round === s.currentMatch!.cupRound)!.played).toBe(true);
          expect(done.time.week).toBe(s.time.week);
          return;
        }
        if (s.currentMatch) s = finishLiveMatch(s);
      }
    }
    throw new Error('Aucun quart de finale atteint');
  });

  it('un tour sans le club se joue quand même', () => {
    const s = playUntilWeek(fresh(2), C.weeks[1]!);
    const atRound = { ...s, cup: { ...s.cup!, rounds: s.cup!.rounds.map((r) => ({ ...r, ties: r.ties.filter((t) => t.home !== MY_TEAM_ID && t.away !== MY_TEAM_ID) })) } };
    const played = playCupRound(atRound);
    expect(played.live).toBeNull();
  });
});

describe('saison suivante', () => {
  it('une nouvelle coupe, avec les deux premiers de l’Élite exemptés', () => {
    const end = playUntilWeek(fresh(6), 19);
    const off = applyAction(end, { type: 'advance' });
    const elite = off.league.divisions.find((d) => d.id === 'D1')!;
    const expectedByes = standings(elite.table).slice(0, 2).map((r) => r.team);
    let s = off;
    for (const p of s.squad.players.filter((x) => x.contractYears <= 0)) s = applyAction(s, { type: 'renewContract', playerId: p.id, years: 1 });
    const next = startSeason(s);
    if (next.phase !== 'season') return;
    expect(next.cup!.season).toBe(2);
    expect(next.cup!.byes.sort()).toEqual(expectedByes.sort());
    expect(next.cup!.rounds).toHaveLength(1);
    expect(endSeason).toBeDefined();
  });
});
