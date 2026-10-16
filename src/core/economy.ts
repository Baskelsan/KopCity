// Économie de la semaine : affluence, recettes, dépenses, supporters et satisfaction (voir docs/CADRAGE.md).
import balance from '../data/balance.json';
import { accessCap, barRates, satisfactionTarget, shopWeeklyRevenue, stadiumCapacity, supporters, weeklyUpkeep } from './city';
import { attendanceFactor, sponsorBonusPerWeek } from './effects';
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

/** Effet du prix sur la demande : plus le billet est cher, moins il y a de monde (élasticité 1,2). */
export function priceDemandFactor(priceFactor: number): number {
  return Math.pow(priceFactor, -balance.ticketing.elasticity);
}

/** Prix du billet en euros pour la division et le réglage choisi. */
export function ticketPrice(state: GameState): number {
  return Math.round(E.ticketPrice[state.league.myDivision] * state.club.ticketPriceFactor);
}

/** Affluence = min(capacité, plafond d'accès, supporters × attrait du match × effet du prix). */
export function attendanceFor(city: City, attraction: number, priceFactor = 1): AttendanceDetail {
  const fans = supporters(city);
  const capacity = stadiumCapacity(city);
  const cap = accessCap(city);
  const demand = Math.round(fans * attraction * priceDemandFactor(priceFactor));
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
  const priceFactor = state.club.ticketPriceFactor;
  const attendance = homeOpponentId
    ? Math.round(attendanceFor(city, matchAttraction(state, homeOpponentId), priceFactor).attendance * attendanceFactor(state))
    : null;
  const barsPerSpectator = barRates(city).reduce((sum, b) => sum + b.perSpectator, 0);
  return {
    income: {
      tickets: attendance ? attendance * ticketPrice(state) : 0,
      bars: attendance ? Math.round(attendance * barsPerSpectator) : 0,
      shop: Math.round(shopWeeklyRevenue(city)),
      sponsors:
        Math.round(E.sponsorBase[division] * sponsorCoefficient(state) * state.club.sponsorMultiplier) +
        sponsorBonusPerWeek(state),
      other: 0,
      cup: 0,
    },
    expenses: {
      wages: weeklyWagesRounded(state),
      upkeep: weeklyUpkeep(city),
      running: E.runningCosts,
      fines: city.residentSatisfaction < E.fineBelowSatisfaction ? E.finePerWeek : 0,
      other: 0,
      staff: staffWeeklyCost(state),
    },
    attendance,
  };
}

export const totalIncome = (r: FinanceReport) =>
  r.income.tickets + r.income.bars + r.income.shop + r.income.sponsors + r.income.other + r.income.cup;
export const totalExpenses = (r: FinanceReport) =>
  r.expenses.wages + r.expenses.upkeep + r.expenses.running + r.expenses.fines + r.expenses.other + r.expenses.staff;
export const netResult = (r: FinanceReport) => totalIncome(r) - totalExpenses(r);

export function emptyReport(): FinanceReport {
  return {
    income: { tickets: 0, bars: 0, shop: 0, sponsors: 0, other: 0, cup: 0 },
    expenses: { wages: 0, upkeep: 0, running: 0, fines: 0, other: 0, staff: 0 },
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

/** Salaire hebdomadaire du staff embauché. */
export function staffWeeklyCost(state: GameState): number {
  const S = balance.staff;
  return (
    (state.staff.physio ? S.physio.weeklyCost : 0) +
    (state.staff.scout ? S.scout.weeklyCost : 0) +
    (state.staff.analyst ? S.analyst.weeklyCost : 0)
  );
}

/** Prix réglable par pas de 10 %, entre 50 % et 200 % du prix de base. */
export function clampTicketFactor(factor: number): number {
  const T = balance.ticketing;
  const stepped = Math.round(factor / T.step) * T.step;
  return Math.round(Math.min(T.maxFactor, Math.max(T.minFactor, stepped)) * 100) / 100;
}

/** Un billet trop cher fâche les supporters : un peu moins de supporters à chaque match à domicile. */
export function ticketPriceSupporterPenalty(state: GameState, homeMatch: boolean): number {
  const T = balance.ticketing;
  return homeMatch && state.club.ticketPriceFactor > T.angryAbove ? T.supporterPenaltyPerMatch : 0;
}

/** La satisfaction se rapproche de sa cible de 2 points au plus par semaine. */
export function nextSatisfaction(city: City): number {
  const target = satisfactionTarget(city);
  const step = balance.satisfaction.maxWeeklyChange;
  return city.residentSatisfaction + clamp(target - city.residentSatisfaction, -step, step);
}

/**
 * L'argent qui ne vient pas de la semaine (événements, transferts) : il compte pour le record de trésorerie
 * et, pendant la saison, s'ajoute aux comptes, pour que trésorerie et récapitulatif restent d'accord.
 */
export function recordOtherMoney(before: GameState, after: GameState): GameState {
  const delta = after.club.treasury - before.club.treasury;
  if (delta === 0) return after;
  const records = { ...after.records, bestTreasury: Math.max(after.records.bestTreasury, after.club.treasury) };
  if (after.phase !== 'season') return { ...after, records };
  const season = after.finance.season;
  return {
    ...after,
    records,
    finance: {
      ...after.finance,
      season: {
        ...season,
        income: { ...season.income, other: season.income.other + Math.max(0, delta) },
        expenses: { ...season.expenses, other: season.expenses.other + Math.max(0, -delta) },
      },
    },
  };
}
