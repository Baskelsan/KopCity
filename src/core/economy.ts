// Économie de la semaine : affluence, recettes, dépenses, supporters et satisfaction (voir docs/CADRAGE.md).
import balance from '../data/balance.json';
import { accessCap, barRates, satisfactionTarget, shopWeeklyRevenue, stadiumCapacity, supporters, weeklyUpkeep } from './city';
import { myDivision, myForm, rankOf } from './league';
import { MY_TEAM_ID, type City, type FinanceReport, type GameState } from './state';

const E = balance.economy;
const A = balance.attraction;

export type AttendanceLimit = 'capacity' | 'accessCap' | 'demand';

export interface AttendanceDetail {
  attendance: number;
  capacity: number;
  accessCap: number;
  /** Supporters × attrait du match. */
  demand: number;
  supporters: number;
  attraction: number;
  limitedBy: AttendanceLimit;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Attrait du match (0,7 à 1,2) : base, bonus de derby, rang de l'adversaire
 * (le premier attire plus, le dernier moins) et forme du club sur ses derniers matchs.
 */
export function matchAttraction(state: GameState, opponentId: string): number {
  const division = myDivision(state.league);
  let attraction = A.base;
  if (opponentId === state.league.rivalId) attraction += A.derby;

  const started = division.table.some((row) => row.played > 0);
  if (started) {
    const teams = division.table.length;
    const rank = rankOf(division.table, opponentId);
    // Rang 1 → +spread, dernier → −spread, régulier entre les deux.
    attraction += A.opponentRankSpread * (1 - (2 * (rank - 1)) / (teams - 1));
  }

  for (const result of myForm(division).slice(-A.formMatches)) {
    if (result === 'W') attraction += A.formPerResult;
    if (result === 'L') attraction -= A.formPerResult;
  }
  return clamp(attraction, A.min, A.max);
}

/** Affluence = min(capacité, plafond d'accès, supporters × attrait du match). */
export function attendanceFor(city: City, attraction: number): AttendanceDetail {
  const fans = supporters(city);
  const capacity = stadiumCapacity(city);
  const cap = accessCap(city);
  const demand = Math.round(fans * attraction);
  const attendance = Math.min(capacity, cap, demand);
  const limitedBy: AttendanceLimit = attendance === capacity ? 'capacity' : attendance === cap ? 'accessCap' : 'demand';
  return { attendance, capacity, accessCap: cap, demand, supporters: fans, attraction, limitedBy };
}

/** Coefficient sponsor selon le classement : 1,4 pour le premier, 0,8 pour le dernier, 1 avant la 1re journée. */
export function sponsorCoefficient(state: GameState): number {
  const division = myDivision(state.league);
  if (!division.table.some((row) => row.played > 0)) return E.sponsorCoefficientBeforeStart;
  const rank = rankOf(division.table, MY_TEAM_ID);
  const teams = division.table.length;
  return E.sponsorCoefficientFirst - ((rank - 1) * (E.sponsorCoefficientFirst - E.sponsorCoefficientLast)) / (teams - 1);
}

export function weeklyWagesRounded(state: GameState): number {
  const monthly = state.squad.players.reduce((sum, p) => sum + p.monthlySalary, 0);
  return Math.round((monthly * E.monthsPerYear) / E.weeksPerYear);
}

/** Comptes de la semaine, calculés sur l'état d'avant le match (classement, forme, supporters). */
export function weekFinance(state: GameState, homeOpponentId: string | null): FinanceReport {
  const { city } = state;
  const division = state.league.myDivision;
  const attendance = homeOpponentId ? attendanceFor(city, matchAttraction(state, homeOpponentId)).attendance : null;
  const barsPerSpectator = barRates(city).reduce((sum, b) => sum + b.perSpectator, 0);
  return {
    income: {
      tickets: attendance ? attendance * E.ticketPrice[division] : 0,
      bars: attendance ? Math.round(attendance * barsPerSpectator) : 0,
      shop: Math.round(shopWeeklyRevenue(city)),
      sponsors: Math.round(E.sponsorBase[division] * sponsorCoefficient(state)),
    },
    expenses: {
      wages: weeklyWagesRounded(state),
      upkeep: weeklyUpkeep(city),
      running: E.runningCosts,
      fines: city.residentSatisfaction < E.fineBelowSatisfaction ? E.finePerWeek : 0,
    },
    attendance,
  };
}

export const totalIncome = (r: FinanceReport) => r.income.tickets + r.income.bars + r.income.shop + r.income.sponsors;
export const totalExpenses = (r: FinanceReport) => r.expenses.wages + r.expenses.upkeep + r.expenses.running + r.expenses.fines;
export const netResult = (r: FinanceReport) => totalIncome(r) - totalExpenses(r);

export function emptyReport(): FinanceReport {
  return {
    income: { tickets: 0, bars: 0, shop: 0, sponsors: 0 },
    expenses: { wages: 0, upkeep: 0, running: 0, fines: 0 },
    attendance: null,
  };
}

/** Ajoute les comptes d'une semaine au cumul de la saison. */
export function addReports(total: FinanceReport, week: FinanceReport): FinanceReport {
  const sum = <T extends Record<string, number>>(a: T, b: T): T =>
    Object.fromEntries(Object.keys(a).map((k) => [k, a[k]! + b[k]!])) as T;
  return {
    income: sum(total.income, week.income),
    expenses: sum(total.expenses, week.expenses),
    attendance: week.attendance === null ? total.attendance : (total.attendance ?? 0) + week.attendance,
  };
}

/** Part de supporters après un résultat : +1 point par victoire, −0,5 par défaite, entre 10 % et 60 %. */
export function nextSupporterShare(share: number, outcome: 'win' | 'draw' | 'loss'): number {
  const S = balance.supporters;
  const next = share + S[outcome];
  return Math.round(clamp(next, S.min, S.max) * 10000) / 10000;
}

/** La satisfaction se rapproche de sa cible de 2 points au plus par semaine. */
export function nextSatisfaction(city: City): number {
  const target = satisfactionTarget(city);
  const step = balance.satisfaction.maxWeeklyChange;
  return city.residentSatisfaction + clamp(target - city.residentSatisfaction, -step, step);
}
