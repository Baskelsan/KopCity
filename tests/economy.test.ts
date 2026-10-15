import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import {
  addReports,
  attendanceFor,
  emptyReport,
  matchAttraction,
  netResult,
  nextSatisfaction,
  nextSupporterShare,
  sponsorCoefficient,
  weekFinance,
} from '../src/core/economy';
import { newGame } from '../src/core/game';
import { myDivision, standings } from '../src/core/league';
import { MY_TEAM_ID, type City, type GameState, type TableRow } from '../src/core/state';

const E = balance.economy;
const A = balance.attraction;
const fresh = () => newGame({ seed: 11, now: 'x', clubName: 'FC Test' });

function withCity(state: GameState, city: Partial<City>): GameState {
  return { ...state, city: { ...state.city, ...city } };
}

/** Classement imposé : les équipes dans l'ordre donné, avec des points décroissants. */
function withTable(state: GameState, order: string[]): GameState {
  const table: TableRow[] = order.map((team, i) => ({
    team,
    played: 5,
    points: 30 - i * 3,
    goalsFor: 10,
    goalsAgainst: 5,
  }));
  const division = { ...myDivision(state.league), table };
  return { ...state, league: { ...state.league, divisions: [division] } };
}

describe('affluence', () => {
  it('= supporters × attrait quand la demande est la plus faible', () => {
    const d = attendanceFor(fresh().city, 1);
    expect(d).toMatchObject({ attendance: 4000, demand: 4000, limitedBy: 'demand' });
  });

  it('est plafonnée par la capacité du stade', () => {
    const city = { ...fresh().city, population: 40000 };
    expect(attendanceFor(city, 1)).toMatchObject({ attendance: 6000, limitedBy: 'capacity' });
  });

  it('est plafonnée par le plafond d’accès', () => {
    const city = { ...fresh().city, population: 50000, stadiumLevel: 3 };
    expect(attendanceFor(city, 1)).toMatchObject({ attendance: 7000, capacity: 12000, limitedBy: 'accessCap' });
  });
});

describe('attrait du match', () => {
  it('vaut la base avant la 1re journée, plus le bonus de derby', () => {
    const s = fresh();
    const other = myDivision(s.league).teams.find((t) => t.id !== s.league.rivalId)!.id;
    expect(matchAttraction(s, other)).toBeCloseTo(A.base);
    expect(matchAttraction(s, s.league.rivalId!)).toBeCloseTo(A.base + A.derby);
  });

  it('monte contre le premier et baisse contre le dernier', () => {
    const s0 = fresh();
    const teams = myDivision(s0.league).teams.map((t) => t.id);
    const s = withTable(s0, [teams[0]!, MY_TEAM_ID, ...teams.slice(1)]);
    const first = teams[0]!;
    const last = teams[teams.length - 1]!;
    const rivalBonus = (id: string) => (id === s.league.rivalId ? A.derby : 0);
    expect(matchAttraction(s, first)).toBeCloseTo(A.base + A.opponentRankSpread + rivalBonus(first));
    expect(matchAttraction(s, last)).toBeCloseTo(A.base - A.opponentRankSpread + rivalBonus(last));
  });

  it('reste entre 0,7 et 1,2', () => {
    const s = fresh();
    const division = myDivision(s.league);
    const fixtures = division.fixtures.map((f) =>
      f.home === MY_TEAM_ID && f.week <= 9 ? { ...f, result: { homeGoals: 5, awayGoals: 0, seed: 0 } } : f,
    );
    const hot = { ...s, league: { ...s.league, divisions: [{ ...division, fixtures }] } };
    expect(matchAttraction(hot, s.league.rivalId!)).toBeLessThanOrEqual(A.max);
  });
});

describe('sponsors', () => {
  it('coefficient de 1 avant la 1re journée, 1,4 premier, 0,8 dernier', () => {
    const s = fresh();
    expect(sponsorCoefficient(s)).toBe(1);
    const teams = myDivision(s.league).teams.map((t) => t.id);
    expect(sponsorCoefficient(withTable(s, [MY_TEAM_ID, ...teams]))).toBeCloseTo(1.4);
    expect(sponsorCoefficient(withTable(s, [...teams, MY_TEAM_ID]))).toBeCloseTo(0.8);
  });
});

describe('comptes de la semaine', () => {
  it('à domicile : billetterie, bars, boutique, sponsors, et toutes les dépenses', () => {
    const s = fresh();
    const opponent = myDivision(s.league).teams.find((t) => t.id !== s.league.rivalId)!.id;
    const r = weekFinance(s, opponent);
    const attendance = Math.round(4000 * A.base);
    expect(r.attendance).toBe(attendance);
    expect(r.income.tickets).toBe(attendance * E.ticketPrice.D3);
    expect(r.income.bars).toBe(0);
    expect(r.income.shop).toBe(0);
    expect(r.income.sponsors).toBe(E.sponsorBase.D3);
    const monthly = s.squad.players.reduce((sum, p) => sum + p.monthlySalary, 0);
    expect(r.expenses.wages).toBe(Math.round((monthly * 12) / 52));
    expect(r.expenses.upkeep).toBe(4000);
    expect(r.expenses.running).toBe(E.runningCosts);
    expect(r.expenses.fines).toBe(0);
    expect(netResult(r)).toBe(
      r.income.tickets + r.income.sponsors - r.expenses.wages - r.expenses.upkeep - r.expenses.running,
    );
  });

  it('à l’extérieur : ni billetterie ni bars', () => {
    const r = weekFinance(fresh(), null);
    expect(r.attendance).toBeNull();
    expect(r.income.tickets + r.income.bars).toBe(0);
  });

  it('amende quand les riverains passent sous 20', () => {
    const s = withCity(fresh(), { residentSatisfaction: E.fineBelowSatisfaction - 1 });
    expect(weekFinance(s, null).expenses.fines).toBe(E.finePerWeek);
    expect(weekFinance(withCity(fresh(), { residentSatisfaction: 20 }), null).expenses.fines).toBe(0);
  });

  it('le cumul de la saison additionne chaque poste', () => {
    const r = weekFinance(fresh(), myDivision(fresh().league).teams[0]!.id);
    const total = addReports(addReports(emptyReport(), r), r);
    expect(total.income.tickets).toBe(2 * r.income.tickets);
    expect(total.expenses.wages).toBe(2 * r.expenses.wages);
    expect(total.attendance).toBe(2 * r.attendance!);
    expect(netResult(total)).toBe(2 * netResult(r));
  });
});

describe('supporters et riverains', () => {
  it('+1 point par victoire, −0,5 par défaite, entre 10 % et 60 %', () => {
    expect(nextSupporterShare(0.2, 'win')).toBeCloseTo(0.21);
    expect(nextSupporterShare(0.2, 'loss')).toBeCloseTo(0.195);
    expect(nextSupporterShare(0.2, 'draw')).toBeCloseTo(0.2);
    expect(nextSupporterShare(0.6, 'win')).toBe(0.6);
    expect(nextSupporterShare(0.1, 'loss')).toBe(0.1);
  });

  it('la satisfaction rejoint sa cible de 2 points au plus par semaine', () => {
    const city = fresh().city;
    expect(nextSatisfaction({ ...city, residentSatisfaction: 60 })).toBe(62);
    expect(nextSatisfaction({ ...city, residentSatisfaction: 69 })).toBe(70);
    expect(nextSatisfaction({ ...city, residentSatisfaction: 75 })).toBe(73);
    expect(nextSatisfaction(city)).toBe(70);
  });
});

it('le classement trié reste cohérent avec le tableau fourni', () => {
  const s = fresh();
  const teams = myDivision(s.league).teams.map((t) => t.id);
  expect(standings(myDivision(withTable(s, [MY_TEAM_ID, ...teams]).league).table)[0]!.team).toBe(MY_TEAM_ID);
});
