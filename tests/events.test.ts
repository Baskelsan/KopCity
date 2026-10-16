import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { initialDistricts } from '../src/core/city';
import { netResult, weekFinance } from '../src/core/economy';
import { choiceRefusal, EVENTS, eventSpec, isEligible, rollEvent, triggerEvent } from '../src/core/events';
import { applyAction, newGame, type Action } from '../src/core/game';
import { myDivision } from '../src/core/league';
import { evaluateObjectives, objectiveProgress, sponsorMultiplierFor } from '../src/core/objectives';
import { endSeason, contractedPlayers } from '../src/core/offseason';
import { overall, transferValue } from '../src/core/players';
import { gameSummary } from '../src/core/records';
import { MY_TEAM_ID, type GameState, type Objective, type TableRow } from '../src/core/state';
import { addToHallOfFame, loadHallOfFame } from '../src/storage/hallOfFame';
import { advanceAndHandle, finishLiveMatch } from './helpers';

const fresh = (seed = 9) => newGame({ seed, now: '2026-10-15T10:00:00.000Z', clubName: 'FC Test' });
const run = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);
const resolve = (state: GameState, eventId: string, choiceId: string) =>
  run(triggerEvent(state, eventId), { type: 'resolveEvent', choiceId });

/** Une partie à la semaine 6, avec des résultats imposés pour le club (W/L), du plus ancien au plus récent. */
function withForm(results: ('W' | 'L')[], base = fresh()): GameState {
  const division = myDivision(base.league);
  let i = 0;
  const fixtures = division.fixtures.map((f) => {
    if (f.week > results.length || (f.home !== MY_TEAM_ID && f.away !== MY_TEAM_ID)) return f;
    const r = results[i++]!;
    const mine = r === 'W' ? 2 : 0;
    const theirs = r === 'W' ? 0 : 2;
    const home = f.home === MY_TEAM_ID;
    return { ...f, result: { homeGoals: home ? mine : theirs, awayGoals: home ? theirs : mine, seed: 0 } };
  });
  return {
    ...base,
    time: { ...base.time, week: results.length + 1 },
    league: { ...base.league, divisions: base.league.divisions.map((d) => (d.id === division.id ? { ...d, fixtures } : d)) },
  };
}

/** Le club à un rang donné de sa division, après quelques journées. */
function atRank(rank: number, base = fresh()): GameState {
  const division = myDivision(base.league);
  const order = division.teams.map((t) => t.id);
  order.splice(rank - 1, 0, MY_TEAM_ID);
  const table: TableRow[] = order.map((team, i) => ({ team, played: 5, points: 15 - i, goalsFor: 5, goalsAgainst: 5 }));
  return {
    ...base,
    time: { ...base.time, week: 6 },
    league: { ...base.league, divisions: base.league.divisions.map((d) => (d.id === division.id ? { ...d, table } : d)) },
  };
}

function withPlaced(state: GameState, slotId: string, type: 'transport' | 'academy', level = 1): GameState {
  return {
    ...state,
    city: {
      ...state.city,
      districts: state.city.districts.map((d) => ({
        ...d,
        slots: d.slots.map((s) => (s.id === slotId ? { ...s, building: { type, level } } : s)),
      })),
    },
  };
}

describe('catalogue', () => {
  it('compte 12 événements à 2 choix, tous décrits dans les textes', async () => {
    const texts = (await import('../src/data/texts.fr.json')).default;
    expect(EVENTS).toHaveLength(12);
    for (const e of EVENTS) {
      expect(e.choices).toHaveLength(2);
      const t = texts.events[e.id as keyof typeof texts.events];
      expect(t.title).toBeTruthy();
      for (const c of e.choices) expect(t.choices[c.id as keyof typeof t.choices]).toBeTruthy();
    }
  });
});

describe('conditions', () => {
  const s = fresh();
  const eligible = (state: GameState, id: string) => isEligible(state, eventSpec(id));

  it('les événements au hasard sont toujours possibles', () => {
    for (const id of ['starInjured', 'damagedPitch', 'paidFriendly']) expect(eligible(s, id)).toBe(true);
  });

  it('voisins excédés : satisfaction sous 50', () => {
    expect(eligible(s, 'angryNeighbours')).toBe(false);
    expect(eligible({ ...s, city: { ...s.city, residentSatisfaction: 49 } }, 'angryNeighbours')).toBe(true);
  });

  it('subvention : dans le top 5, après au moins une journée', () => {
    expect(eligible(s, 'cityGrant')).toBe(false);
    expect(eligible(atRank(5), 'cityGrant')).toBe(true);
    expect(eligible(atRank(6), 'cityGrant')).toBe(false);
  });

  it('offre pour un joueur : un joueur noté 2 de plus que le niveau de la division', () => {
    const level = balance.players.divisionLevel.D3;
    const star = { ...s, squad: { ...s.squad, players: s.squad.players.map((p, i) => (i === 0 ? { ...p, pos: 'ATT' as const, stats: { att: 20, def: 20, pas: 20, phy: 20 } } : p)) } };
    expect(eligible(star, 'playerOffer')).toBe(true);
    const weak = { ...s, squad: { ...s.squad, players: s.squad.players.map((p) => ({ ...p, stats: { att: level, def: level, pas: level, phy: level } })) } };
    expect(eligible(weak, 'playerOffer')).toBe(false);
  });

  it('sponsor maillot : 4 victoires de suite ; série de défaites : 3 de suite', () => {
    expect(eligible(withForm(['W', 'W', 'W', 'W']), 'shirtSponsor')).toBe(true);
    expect(eligible(withForm(['W', 'L', 'W', 'W', 'W']), 'shirtSponsor')).toBe(false);
    expect(eligible(withForm(['W', 'L', 'L', 'L']), 'losingStreak')).toBe(true);
    expect(eligible(withForm(['L', 'L', 'W']), 'losingStreak')).toBe(false);
  });

  it('jeune prodige : centre de formation au niveau 1 ou plus', () => {
    expect(eligible(s, 'prodigy')).toBe(false);
    expect(eligible(withPlaced(s, 'stade-1', 'academy'), 'prodigy')).toBe(true);
  });

  it('dispute au vestiaire : moral moyen sous 50', () => {
    expect(eligible(s, 'dressingRoom')).toBe(false);
    const sad = { ...s, squad: { ...s.squad, players: s.squad.players.map((p) => ({ ...p, morale: 40 })) } };
    expect(eligible(sad, 'dressingRoom')).toBe(true);
  });

  it('grève : au moins un transport ; inspection : capacité au-dessus de 8 000', () => {
    expect(eligible(s, 'transportStrike')).toBe(false);
    expect(eligible(withPlaced(s, 'stade-1', 'transport'), 'transportStrike')).toBe(true);
    expect(eligible(s, 'safetyInspection')).toBe(false);
    expect(eligible({ ...s, city: { ...s.city, stadiumLevel: 2 } }, 'safetyInspection')).toBe(true);
  });
});

describe('chaque événement et ses choix', () => {
  const s = fresh();

  it('star blessée : la reposer = absente 1 semaine ; la faire jouer = 40 % de risque', () => {
    const pending = triggerEvent(s, 'starInjured').events.pending!;
    const rested = run(triggerEvent(s, 'starInjured'), { type: 'resolveEvent', choiceId: 'rest' });
    expect(rested.squad.players.find((p) => p.id === pending.targetPlayerId)!.injuryWeeks).toBe(1);
    let hits = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = fresh(seed);
      const t = triggerEvent(g, 'starInjured');
      const after = run(t, { type: 'resolveEvent', choiceId: 'play' });
      const weeks = after.squad.players.find((p) => p.id === t.events.pending!.targetPlayerId)!.injuryWeeks;
      if (weeks > 0) {
        hits++;
        expect(weeks).toBeGreaterThanOrEqual(3);
        expect(weeks).toBeLessThanOrEqual(5);
      }
    }
    expect(hits / 200).toBeGreaterThan(0.28);
    expect(hits / 200).toBeLessThan(0.52);
  });

  it('voisins excédés : mur antibruit ou satisfaction en baisse', () => {
    const angry = { ...s, city: { ...s.city, residentSatisfaction: 45 } };
    const wall = resolve(angry, 'angryNeighbours', 'wall');
    expect(wall.club.treasury).toBe(angry.club.treasury - 30000);
    expect(wall.city.residentSatisfaction).toBe(55);
    expect(resolve(angry, 'angryNeighbours', 'ignore').city.residentSatisfaction).toBe(35);
  });

  it('subvention : 80 000 € et un engagement, remboursé si pas de transport en fin de saison', () => {
    const accepted = resolve(atRank(3), 'cityGrant', 'accept');
    expect(accepted.club.treasury).toBe(atRank(3).club.treasury + 80000);
    expect(accepted.effects.some((e) => e.kind === 'commitTransport')).toBe(true);
    const seasonEnd = { ...accepted, time: { ...accepted.time, week: 19 } };
    const broken = run(seasonEnd, { type: 'advance' });
    expect(broken.phase).toBe('offseason');
    expect(broken.effects.some((e) => e.kind === 'commitTransport')).toBe(false);
    const kept = run(withPlaced(seasonEnd, 'stade-2', 'transport'), { type: 'advance' });
    const rewards = (x: GameState) => x.offseason!.objectiveResults.reduce((sum, r) => sum + r.reward, 0);
    const bonus = (x: GameState) => x.offseason!.summary.bonus;
    expect(kept.club.treasury - bonus(kept) - rewards(kept) - (broken.club.treasury - bonus(broken) - rewards(broken))).toBe(80000);
    expect(resolve(atRank(3), 'cityGrant', 'refuse').club.treasury).toBe(atRank(3).club.treasury);
  });

  it('offre pour un joueur : vendre à 120 % de sa valeur, ou le garder avec +15 de moral', () => {
    const star = { ...s, squad: { ...s.squad, players: s.squad.players.map((p, i) => (i === 3 ? { ...p, pos: 'MIL' as const, stats: { att: 19, def: 19, pas: 19, phy: 19 } } : p)) } };
    const t = triggerEvent(star, 'playerOffer');
    const target = star.squad.players.find((p) => p.id === t.events.pending!.targetPlayerId)!;
    expect(overall(target)).toBeGreaterThanOrEqual(12);
    expect(t.events.pending!.offerPrice).toBe(Math.round(transferValue(target) * 1.2));
    const sold = run(t, { type: 'resolveEvent', choiceId: 'sell' });
    expect(sold.squad.players.map((p) => p.id)).not.toContain(target.id);
    expect(sold.club.treasury).toBe(star.club.treasury + t.events.pending!.offerPrice);
    const kept = run(t, { type: 'resolveEvent', choiceId: 'refuse' });
    expect(kept.squad.players.find((p) => p.id === target.id)!.morale).toBe(target.morale + 15);
  });

  it('sponsor maillot : un revenu par semaine pendant 8 ou 25 semaines', () => {
    const short = resolve(s, 'shirtSponsor', 'short');
    expect(short.effects).toContainEqual({ kind: 'sponsorBonus', perWeek: 6000, weeksLeft: 8 });
    const baseSponsors = weekFinance(s, null).income.sponsors;
    expect(weekFinance(short, null).income.sponsors).toBe(baseSponsors + 6000);
    expect(resolve(s, 'shirtSponsor', 'exclusive').effects).toContainEqual({ kind: 'sponsorBonus', perWeek: 3000, weeksLeft: 25 });
  });

  it('jeune prodige : signé gratuitement, formé au club ; refusé si l’effectif est plein', () => {
    const withAcademy = withPlaced(s, 'stade-1', 'academy');
    const t = triggerEvent(withAcademy, 'prodigy');
    const prodigy = t.events.pending!.prodigy!;
    expect(prodigy.homegrown).toBe(true);
    const signed = run(t, { type: 'resolveEvent', choiceId: 'sign' });
    expect(signed.squad.players.map((p) => p.id)).toContain(prodigy.id);
    expect(signed.club.treasury).toBe(withAcademy.club.treasury);
    const fullSquad = Array.from({ length: balance.squadSize.max }, (_, i) => ({ ...s.squad.players[0]!, id: `f${i}` }));
    const full = { ...t, squad: { ...t.squad, players: fullSquad } };
    expect(choiceRefusal(full, eventSpec('prodigy').choices[0]!)).toBe('squadFull');
    expect(run(full, { type: 'resolveEvent', choiceId: 'sign' })).toBe(full);
  });

  it('dispute au vestiaire : réunion (+10 moral) ou sanction (+20 000 €, −5 moral)', () => {
    const meeting = resolve(s, 'dressingRoom', 'meeting');
    expect(meeting.squad.players[0]!.morale).toBe(s.squad.players[0]!.morale + 10);
    const fine = resolve(s, 'dressingRoom', 'fine');
    expect(fine.club.treasury).toBe(s.club.treasury + 20000);
    expect(fine.squad.players[0]!.morale).toBe(s.squad.players[0]!.morale - 5);
  });

  it('pelouse abîmée : réparer 20 000 € ou −5 % de force à domicile pendant 2 matchs', () => {
    expect(resolve(s, 'damagedPitch', 'repair').club.treasury).toBe(s.club.treasury - 20000);
    const playOn = resolve(s, 'damagedPitch', 'playOn');
    expect(playOn.effects).toContainEqual({ kind: 'homeStrength', factor: 0.95, matchesLeft: 2 });
  });

  it('match amical rémunéré : +30 000 € et 25 % de risque de blessure', () => {
    const accepted = resolve(s, 'paidFriendly', 'accept');
    expect(accepted.club.treasury).toBe(s.club.treasury + 30000);
    expect(resolve(s, 'paidFriendly', 'refuse').club.treasury).toBe(s.club.treasury);
  });

  it('grève des transports : affluence −30 % au prochain match à domicile, ou navettes', () => {
    const base = withPlaced(s, 'stade-1', 'transport');
    const endure = resolve(base, 'transportStrike', 'endure');
    const opponent = myDivision(s.league).teams[0]!.id;
    expect(weekFinance(endure, opponent).attendance).toBe(Math.round(weekFinance(base, opponent).attendance! * 0.7));
    expect(resolve(base, 'transportStrike', 'shuttles').club.treasury).toBe(base.club.treasury - 15000);
  });

  it('inspection : mise aux normes 40 000 €, ou 50 % de risque d’amende de 80 000 €', () => {
    const big = { ...s, city: { ...s.city, stadiumLevel: 2 } };
    expect(resolve(big, 'safetyInspection', 'upgrade').club.treasury).toBe(big.club.treasury - 40000);
    const outcomes = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const g = { ...fresh(seed), city: { ...fresh(seed).city, stadiumLevel: 2 } };
      outcomes.add(resolve(g, 'safetyInspection', 'gamble').club.treasury - g.club.treasury);
    }
    expect([...outcomes].sort()).toEqual([-80000, 0]);
  });

  it('série de défaites : moral +10 ou supporters +1 point', () => {
    expect(resolve(s, 'losingStreak', 'defend').squad.players[0]!.morale).toBe(s.squad.players[0]!.morale + 10);
    expect(resolve(s, 'losingStreak', 'apologise').city.supporterShare).toBeCloseTo(s.city.supporterShare + 0.01);
  });

  it('un choix trop cher est refusé : la trésorerie ne passe pas sous zéro', () => {
    const poor = { ...s, club: { ...s.club, treasury: 10000 }, city: { ...s.city, residentSatisfaction: 45 } };
    const t = triggerEvent(poor, 'angryNeighbours');
    expect(choiceRefusal(t, eventSpec('angryNeighbours').choices[0]!)).toBe('notEnoughMoney');
    expect(run(t, { type: 'resolveEvent', choiceId: 'wall' })).toBe(t);
  });

  it('le choix est noté dans l’historique et le journal', () => {
    const after = resolve(s, 'damagedPitch', 'repair');
    expect(after.events.pending).toBeNull();
    expect(after.events.history.at(-1)).toMatchObject({ eventId: 'damagedPitch', choiceId: 'repair' });
    expect(after.log.at(-1)).toMatchObject({ key: 'eventResolved' });
    // L'argent de l'événement apparaît dans les comptes de la saison.
    expect(after.finance.season.expenses.other).toBe(20000);
  });
});

describe('tirage hebdomadaire', () => {
  it('jamais avant la semaine 3, une fois par semaine, environ une semaine sur cinq', () => {
    let fired = 0;
    const runs = 600;
    for (let seed = 1; seed <= runs; seed++) {
      const g = fresh(seed);
      expect(rollEvent(g).events.pending).toBeNull();
      const week5 = { ...g, time: { ...g.time, week: 5 } };
      const rolled = rollEvent(week5);
      if (rolled.events.pending) fired++;
      // Pas de second tirage la même semaine.
      const again = rollEvent({ ...rolled, events: { ...rolled.events, pending: null } });
      expect(again.events.pending).toBeNull();
    }
    expect(fired / runs).toBeGreaterThan(0.15);
    expect(fired / runs).toBeLessThan(0.25);
  });

  it('Avancer s’arrête sur un événement, et attend la réponse', () => {
    let s = fresh(3);
    for (let i = 0; i < 40 && !s.events.pending; i++) {
      s = run(s, { type: 'advance' });
      if (s.currentMatch) s = finishLiveMatch(s);
    }
    expect(s.events.pending).not.toBeNull();
    expect(s.alerts[0]).toMatchObject({ key: 'event' });
    expect(run(s, { type: 'advance' })).toBe(s);
  });

  it('les effets temporaires s’usent : pelouse sur 2 matchs à domicile, sponsor chaque semaine', () => {
    let s = resolve(resolve(fresh(4), 'damagedPitch', 'playOn'), 'shirtSponsor', 'short');
    // Assez d'appuis pour 12 semaines, matchs de coupe compris.
    for (let i = 0; i < 40 && s.time.week <= 13; i++) s = advanceAndHandle(s);
    expect(s.effects.some((e) => e.kind === 'homeStrength')).toBe(false);
    expect(s.effects.some((e) => e.kind === 'sponsorBonus')).toBe(false);
  });
});

describe('objectifs de saison', () => {
  it('3 objectifs : un sportif, un financier, un urbain', () => {
    expect(fresh().objectives.map((o) => o.category)).toEqual(['sport', 'finance', 'city']);
  });

  const obj = (type: string, value: number): Objective => ({ id: 'x', category: 'sport', type, value, achieved: false });

  it('se mesurent sur l’état de la partie', () => {
    expect(objectiveProgress(atRank(4), obj('rankAtMost', 5)).done).toBe(true);
    expect(objectiveProgress(atRank(6), obj('rankAtMost', 5)).done).toBe(false);
    const s = fresh();
    expect(objectiveProgress(s, obj('treasuryAtLeast', 300000)).done).toBe(true);
    expect(objectiveProgress({ ...s, club: { ...s.club, treasury: 1 } }, obj('treasuryAtLeast', 300000)).done).toBe(false);
    expect(objectiveProgress(s, obj('satisfactionAtLeast', 60)).done).toBe(true);
    expect(objectiveProgress(withForm(['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W']), obj('homeUnbeatenStreak', 5)).done).toBe(true);
    const built = { ...s, log: [1, 2].map((i) => ({ season: 1, week: i, key: 'constructionDelivered', params: {} })) };
    expect(objectiveProgress(built, obj('buildingsDelivered', 2)).done).toBe(true);
  });

  it('chaque objectif atteint rapporte 50 000 € (×1,5 en D2, ×2 en Élite)', () => {
    const s = { ...atRank(1), objectives: [obj('rankAtMost', 5), obj('treasuryAtLeast', 300000), obj('satisfactionAtLeast', 90)] };
    expect(evaluateObjectives(s, 'D3').map((r) => r.reward)).toEqual([50000, 50000, 0]);
    expect(evaluateObjectives(s, 'D2')[0]!.reward).toBe(75000);
    expect(evaluateObjectives(s, 'D1')[0]!.reward).toBe(100000);
  });

  it('les trois atteints : sponsors +10 % la saison suivante', () => {
    expect(sponsorMultiplierFor([{ id: 'a', achieved: true, reward: 1 }, { id: 'b', achieved: true, reward: 1 }])).toBeCloseTo(1.1);
    expect(sponsorMultiplierFor([{ id: 'a', achieved: true, reward: 1 }, { id: 'b', achieved: false, reward: 0 }])).toBe(1);
    const s = { ...fresh(), club: { ...fresh().club, sponsorMultiplier: 1.1 } };
    expect(weekFinance(s, null).income.sponsors).toBe(Math.round(balance.economy.sponsorBase.D3 * 1.1));
  });
});

describe('palmarès et records', () => {
  it('compte les buts, la meilleure affluence et la plus grosse trésorerie', () => {
    let s = fresh(12);
    for (let i = 0; i < 8; i++) s = advanceAndHandle(s);
    const goals = myDivision(s.league).fixtures
      .filter((f) => f.result && (f.home === MY_TEAM_ID || f.away === MY_TEAM_ID))
      .reduce((sum, f) => sum + (f.home === MY_TEAM_ID ? f.result!.homeGoals : f.result!.awayGoals), 0);
    expect(s.records.scorers.reduce((sum, x) => sum + x.goals, 0)).toBe(goals);
    expect(s.records.bestAttendance).toBeGreaterThan(0);
    expect(s.records.bestTreasury).toBeGreaterThanOrEqual(s.club.treasury);
  });

  it('un titre en finissant premier, une montée, l’historique des saisons', () => {
    const champion = { ...atRank(1), time: { season: 1, week: 19 } };
    const after = endSeason(champion);
    expect(after.records.titles).toEqual([{ season: 1, division: 'D3' }]);
    expect(after.records.promotions).toBe(1);
    expect(after.records.history).toEqual([{ season: 1, division: 'D3', rank: 1 }]);
  });
});

describe('faillite', () => {
  /** Une partie ruinée : 3 semaines dans le rouge déjà, une trésorerie très négative. */
  const broke = (): GameState => {
    const s = fresh(21);
    return { ...s, club: { ...s.club, treasury: -2_000_000, weeksInRed: 3 } };
  };

  it('4 semaines de suite dans le rouge : la partie s’arrête', () => {
    const s = advanceAndHandle(broke());
    expect(s.phase).toBe('gameOver');
    expect(s.gameOver).not.toBeNull();
    expect(s.alerts.some((a) => a.key === 'bankruptcy')).toBe(true);
    expect(run(s, { type: 'advance' })).toBe(s);
  });

  it('une semaine dans le vert remet le compteur à zéro', () => {
    const s = fresh(21);
    const recovering = { ...s, club: { ...s.club, treasury: 1_000_000, weeksInRed: 3 } };
    expect(advanceAndHandle(recovering).club.weeksInRed).toBe(0);
  });

  it('le bilan de la partie est gardé à part, puis une nouvelle partie commence', async () => {
    const over = advanceAndHandle(broke());
    const summary = gameSummary(over, '2026-10-16T10:00:00.000Z');
    expect(summary).toMatchObject({ clubName: 'FC Test', seasons: 1, promotions: 0 });
    const all = await addToHallOfFame(summary);
    expect(all.at(-1)).toEqual(summary);
    expect((await loadHallOfFame()).at(-1)).toEqual(summary);
    const next = fresh(22);
    expect(next.phase).toBe('season');
    expect(next.records.titles).toEqual([]);
  });
});

it('les comptes de la saison restent d’accord avec la trésorerie, événements et mercato compris', () => {
  let s = fresh(31);
  const start = s.club.treasury;
  for (let i = 0; i < 30 && s.phase === 'season' && s.time.week <= 18; i++) s = advanceAndHandle(s);
  expect(s.club.treasury).toBe(start + netResult(s.finance.season));
  expect(contractedPlayers(s.squad.players).length).toBeGreaterThan(0);
  expect(initialDistricts()).toHaveLength(4);
});
