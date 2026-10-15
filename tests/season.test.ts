import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { netResult } from '../src/core/economy';
import { applyAction, newGame, type Action } from '../src/core/game';
import { myDivision, myFixture, opponentOf } from '../src/core/league';
import { finishLiveMatch, resolvePendingEvent } from './helpers';
import { advance, keyMatchReasons } from '../src/core/season';
import { MY_TEAM_ID, type GameState, type TableRow } from '../src/core/state';

const SEASON = balance.league.seasonWeeks;
const fresh = (seed = 2024) => newGame({ seed, now: '2026-10-15T10:00:00.000Z', clubName: 'FC Test' });
const run = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);

const finishLive = finishLiveMatch;

/** Joue toute la saison en appuyant sur « Avancer » ; renvoie l'état final et chaque arrêt. */
function playSeason(start: GameState) {
  let s = start;
  const stops: GameState[] = [];
  for (let guard = 0; guard < 100 && s.time.week <= SEASON; guard++) {
    s = applyAction(s, { type: 'advance' });
    stops.push(s);
    if (s.events.pending) s = resolvePendingEvent(s);
    if (s.currentMatch) s = finishLive(s);
  }
  return { final: s, stops };
}

describe('effectif : actions', () => {
  it('changer de formation recalcule la composition automatique', () => {
    const s = run(fresh(), { type: 'setFormation', formation: '4-3-3' });
    const atts = s.squad.lineup.slice(8).map((id) => s.squad.players.find((p) => p.id === id)!.pos);
    expect(atts).toEqual(['ATT', 'ATT', 'ATT']);
  });

  it('un échange manuel coupe la composition automatique', () => {
    const s0 = fresh();
    const benchId = s0.squad.players.find((p) => !s0.squad.lineup.includes(p.id))!.id;
    const s = run(s0, { type: 'swapPlayers', a: s0.squad.lineup[5]!, b: benchId });
    expect(s.squad.autoLineup).toBe(false);
    expect(s.squad.lineup[5]).toBe(benchId);
    expect(run(s, { type: 'setAutoLineup', value: true }).squad.lineup).toEqual(s0.squad.lineup);
  });
});

describe('matchs à enjeu', () => {
  /** Place le club et son adversaire de la semaine dans un classement imposé. */
  function setup(week: number, myPoints: number, opponentPoints: number, myRank: number, opponentRank: number) {
    const s0 = fresh();
    const division = myDivision(s0.league);
    const fixture = myFixture(division, week)!;
    const opponent = opponentOf(fixture);
    const others = division.teams.map((t) => t.id).filter((id) => id !== opponent);
    const order: string[] = [...others];
    const slots: [number, string][] = [
      [myRank, MY_TEAM_ID],
      [opponentRank, opponent],
    ];
    slots.sort((a, b) => a[0] - b[0]).forEach(([rank, id]) => order.splice(rank - 1, 0, id));
    const table: TableRow[] = order.map((team, i) => ({
      team,
      played: week - 1,
      points: team === MY_TEAM_ID ? myPoints : team === opponent ? opponentPoints : 40 - i * 4,
      goalsFor: 0,
      goalsAgainst: 0,
    }));
    const s: GameState = {
      ...s0,
      time: { ...s0.time, week },
      league: { ...s0.league, rivalId: 'nobody', divisions: [{ ...division, table }] },
    };
    return { s, opponent };
  }

  it('le derby est un match à enjeu', () => {
    const s = fresh();
    const week = myDivision(s.league).fixtures.find(
      (f) => f.home === s.league.rivalId && f.away === MY_TEAM_ID,
    )!.week;
    expect(keyMatchReasons({ ...s, time: { ...s.time, week } })).toContain('derby');
  });

  it('un concurrent direct : 3 points d’écart au plus et proche au classement', () => {
    expect(keyMatchReasons(setup(6, 12, 10, 4, 5).s)).toContain('directRival');
    expect(keyMatchReasons(setup(6, 12, 8, 4, 5).s)).not.toContain('directRival');
    // Trop tôt dans la saison, même avec un petit écart.
    expect(keyMatchReasons(setup(2, 3, 3, 4, 5).s)).not.toContain('directRival');
  });

  it('dans les 3 dernières journées, la montée ou le maintien en jeu', () => {
    expect(keyMatchReasons(setup(17, 31, 0, 3, 10).s)).toContain('promotion');
    expect(keyMatchReasons(setup(17, 8, 0, 8, 10).s)).toContain('relegation');
    expect(keyMatchReasons(setup(14, 31, 0, 3, 10).s)).not.toContain('promotion');
  });

  it('le réglage « tous en direct » arrête chaque semaine', () => {
    const s = run(fresh(), { type: 'setAlwaysLiveMatches', value: true }, { type: 'advance' });
    expect(s.currentMatch?.live).toBe(true);
    expect(s.time.week).toBe(1);
    expect(s.alerts[0]).toMatchObject({ key: 'keyMatch' });
  });
});

describe('Avancer', () => {
  it('ne fait rien tant qu’un match en direct n’est pas terminé', () => {
    const s = run(fresh(), { type: 'setAlwaysLiveMatches', value: true }, { type: 'advance' });
    expect(run(s, { type: 'advance' })).toBe(s);
    expect(run(s, { type: 'finishMatch' })).toBe(s);
  });

  it('un match en direct terminé clôt la semaine comme un match en résumé', () => {
    const s = run(fresh(), { type: 'setAlwaysLiveMatches', value: true }, { type: 'advance' });
    const done = finishLive(s);
    expect(done.currentMatch).toBeNull();
    expect(done.time.week).toBe(2);
    const fixture = myFixture(myDivision(done.league), 1)!;
    expect(fixture.result).not.toBeNull();
    expect(fixture.live).toBe(true);
    expect(myDivision(done.league).fixtures.filter((f) => f.week === 1).every((f) => f.result)).toBe(true);
  });

  it('s’arrête après une semaine où un chantier est livré', () => {
    const s0 = run({ ...fresh(), club: { ...fresh().club, treasury: 1_000_000 } }, { type: 'build', slotId: 'stade-1', building: 'bar' });
    let s = s0;
    for (let i = 0; i < 5 && !s.alerts.some((a) => a.key === 'constructionDelivered'); i++) {
      s = applyAction(s, { type: 'advance' });
      if (s.currentMatch) s = finishLive(s);
    }
    expect(s.alerts.some((a) => a.key === 'constructionDelivered')).toBe(true);
    expect(s.time.week).toBe(3);
  });

  it('s’arrête chaque semaine où la trésorerie est négative', () => {
    const broke = { ...fresh(), club: { ...fresh().club, treasury: -200_000 } };
    const s = run(broke, { type: 'advance' });
    const done = s.currentMatch ? finishLive(s) : s;
    expect(done.alerts.some((a) => a.key === 'treasuryNegative')).toBe(true);
    expect(done.club.weeksInRed).toBe(1);
  });

  it('est déterministe : même partie, même saison', () => {
    expect(playSeason(fresh(7)).final).toEqual(playSeason(fresh(7)).final);
  });
});

describe('une saison complète', () => {
  const { final, stops } = playSeason(fresh());
  const division = myDivision(final.league);

  it('enchaîne les 18 journées et s’arrête sur « saison terminée »', () => {
    expect(final.time.week).toBe(SEASON + 1);
    expect(division.fixtures.every((f) => f.result !== null)).toBe(true);
    expect(division.table.every((r) => r.played === SEASON)).toBe(true);
    expect(final.alerts.some((a) => a.key === 'seasonOver')).toBe(true);
    // Avancer après la dernière journée ouvre l'intersaison.
    expect(run(final, { type: 'advance' }).phase).toBe('offseason');
  });

  it('la trésorerie se recalcule poste par poste à l’euro près', () => {
    expect(final.club.treasury).toBe(fresh().club.treasury + netResult(final.finance.season));
    expect(final.finance.season.income.sponsors).toBeGreaterThan(0);
    expect(final.finance.season.attendance).toBeGreaterThan(0);
  });

  it('s’arrête de lui-même, mais pas à chaque semaine', () => {
    expect(stops.length).toBeGreaterThan(2);
    expect(stops.length).toBeLessThan(SEASON);
    for (const stop of stops) expect(stop.alerts.length).toBeGreaterThan(0);
  });

  it('les points du classement correspondent aux résultats', () => {
    const total = division.table.reduce((sum, r) => sum + r.points, 0);
    const draws = division.fixtures.filter((f) => f.result!.homeGoals === f.result!.awayGoals).length;
    expect(total).toBe(3 * (division.fixtures.length - draws) + 2 * draws);
  });

  it('les blessés guérissent au fil des semaines', () => {
    expect(final.squad.players.every((p) => p.injuryWeeks <= balance.match.injuryWeeksMax)).toBe(true);
  });
});

describe('sur 100 saisons simulées', () => {
  const results = Array.from({ length: 100 }, (_, i) => playSeason(fresh(i + 1)));

  it('la marge tourne autour de 200 000 € par saison (hors transferts et événements)', () => {
    const weekly = (r: (typeof results)[number]) => {
      const f = r.final.finance.season;
      return netResult(f) - f.income.other + f.expenses.other;
    };
    const average = results.reduce((sum, r) => sum + weekly(r), 0) / results.length;
    expect(average).toBeGreaterThan(120_000);
    expect(average).toBeLessThan(320_000);
  });

  it('environ une semaine clé toutes les 2 à 3 semaines', () => {
    const live = results.reduce(
      (sum, r) => sum + myDivision(r.final.league).fixtures.filter((f) => f.live).length,
      0,
    );
    const perSeason = live / results.length;
    expect(perSeason).toBeGreaterThan(4);
    expect(perSeason).toBeLessThan(10);
  });
});

it('advance sur l’état directement, comme l’action', () => {
  expect(advance(fresh())).toEqual(run(fresh(), { type: 'advance' }));
});

it('une ancienne entrée du journal portant le même numéro de semaine ne déclenche pas d’arrêt', () => {
  const s0 = fresh();
  const old = { ...s0, log: [{ season: 1, week: 1, key: 'constructionDelivered', params: { type: 'bar', level: 1 } }] };
  const s = run(old, { type: 'advance' });
  expect(s.alerts.some((a) => a.key === 'constructionDelivered')).toBe(false);
});

describe('composition à la main', () => {
  it('un titulaire blessé peut être remplacé par un remplaçant disponible', () => {
    const s0 = fresh();
    const starter = s0.squad.lineup[3]!;
    const hurt: GameState = {
      ...s0,
      squad: { ...s0.squad, players: s0.squad.players.map((p) => (p.id === starter ? { ...p, injuryWeeks: 2 } : p)) },
    };
    const benchId = hurt.squad.players.find((p) => !hurt.squad.lineup.includes(p.id))!.id;
    const s = run(hurt, { type: 'swapPlayers', a: starter, b: benchId });
    expect(s.squad.lineup[3]).toBe(benchId);
  });

  it('une place vide se remplit avec un joueur disponible, et pas avec un blessé', () => {
    const s0 = fresh();
    const lineup = [...s0.squad.lineup];
    lineup[4] = '';
    const s = { ...s0, squad: { ...s0.squad, autoLineup: false, lineup } };
    const benchId = s.squad.players.find((p) => !lineup.includes(p.id))!.id;
    expect(run(s, { type: 'placePlayer', slot: 4, playerId: benchId }).squad.lineup[4]).toBe(benchId);
    const hurt = { ...s, squad: { ...s.squad, players: s.squad.players.map((p) => (p.id === benchId ? { ...p, injuryWeeks: 1 } : p)) } };
    expect(run(hurt, { type: 'placePlayer', slot: 4, playerId: benchId })).toBe(hurt);
  });
});
