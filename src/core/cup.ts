// Coupe nationale : les 30 clubs, 5 tours à élimination directe, joués en semaine en plus du championnat.
// Les deux meilleurs de l'Élite entrent au 2e tour ; le club de la plus petite division reçoit.
import balance from '../data/balance.json';
import { attendanceFor } from './economy';
import { staffInjuryFactor, staffStrengthFactor } from './effects';
import { standings } from './league';
import { clubOutcome, createMatch, runMatch, simulateToEnd, type ClubContext } from './match';
import type { MatchState, Side } from './matchTypes';
import { applyMatchStats } from './playerStats';
import { barRates } from './city';
import { autoLineup, benchOf, effectiveLineup } from './lineup';
import { nextFloat, nextInt, shuffle, type Draw } from './rng';
import { lineupStrength } from './strength';
import { addGoals, addHeadToHead } from './records';
import {
  MY_TEAM_ID,
  type Cup,
  type CupRound,
  type CupTie,
  type DivisionId,
  type GameState,
  type League,
  type LogEntry,
  type Player,
  type Squad,
  type Team,
} from './state';

const C = balance.cup;
const RANK: Record<DivisionId, number> = { D3: 1, D2: 2, D1: 3 };

export function divisionOf(league: League, teamId: string): DivisionId {
  if (teamId === MY_TEAM_ID) return league.myDivision;
  return league.divisions.find((d) => d.teams.some((t) => t.id === teamId))?.id ?? 'D3';
}

function teamById(league: League, teamId: string): Team | undefined {
  for (const d of league.divisions) {
    const t = d.teams.find((x) => x.id === teamId);
    if (t) return t;
  }
  return undefined;
}

/** Le club de la plus petite division reçoit ; à division égale, le premier tiré. */
function orderTie(league: League, a: string, b: string): { home: string; away: string } {
  return RANK[divisionOf(league, b)] < RANK[divisionOf(league, a)] ? { home: b, away: a } : { home: a, away: b };
}

/** Tire les rencontres d'un tour parmi les qualifiés. */
function drawRound(rngState: number, league: League, entrants: string[], round: number): Draw<CupRound> {
  const order = shuffle(rngState, entrants);
  const ties: CupTie[] = [];
  for (let i = 0; i + 1 < order.value.length; i += 2) {
    ties.push({ ...orderTie(league, order.value[i]!, order.value[i + 1]!), result: null, live: false });
  }
  return { value: { round, week: C.weeks[round - 1]!, ties, played: false }, rngState: order.rngState };
}

/**
 * Nouvelle coupe : tous les clubs sauf les deux exemptés (les meilleurs de l'Élite) jouent le 1er tour.
 * `byes` : les deux clubs qui entrent au 2e tour.
 */
export function newCup(rngState: number, league: League, season: number, byes: string[]): Draw<Cup> {
  const all = [MY_TEAM_ID, ...league.divisions.flatMap((d) => d.teams.map((t) => t.id))];
  const entrants = all.filter((id) => !byes.includes(id));
  const first = drawRound(rngState, league, entrants, 1);
  return { value: { season, byes, rounds: [first.value], winner: null }, rngState: first.rngState };
}

/** Les deux exemptés : les deux premiers du dernier classement de l'Élite (ou les deux plus forts au départ). */
export function cupByes(league: League): string[] {
  const elite = league.divisions.find((d) => d.id === 'D1');
  if (!elite) return [];
  if (elite.table.some((r) => r.played > 0)) return standings(elite.table).slice(0, C.byes).map((r) => r.team);
  return [...elite.teams].sort((a, b) => b.level - a.level).slice(0, C.byes).map((t) => t.id);
}

/** Le tour de la semaine, s'il reste à jouer. */
export function cupRoundThisWeek(state: GameState): CupRound | undefined {
  const round = state.cup?.rounds.at(-1);
  return round && !round.played && round.week === state.time.week ? round : undefined;
}

export function myTie(round: CupRound): CupTie | undefined {
  return round.ties.find((t) => t.home === MY_TEAM_ID || t.away === MY_TEAM_ID);
}

/** Le club est-il encore en course (qualifié pour le tour à venir) ? */
export function stillInCup(state: GameState): boolean {
  const last = state.cup?.rounds.at(-1);
  if (!state.cup || !last || last.played) return false;
  return myTie(last) !== undefined || (last.round === 1 && state.cup.byes.includes(MY_TEAM_ID));
}

/** Tirs au but : le meilleur gardien a un peu plus de chances. */
function penaltyShootout(rngState: number, gkHome: number, gkAway: number): Draw<{ home: number; away: number }> {
  const p = 1 / (1 + Math.exp(-C.penaltyGoalkeeperSlope * Math.log(Math.max(gkHome, 0.1) / Math.max(gkAway, 0.1))));
  const roll = nextFloat(rngState);
  const winnerScore = nextInt(roll.rngState, 3, 5);
  const loserScore = nextInt(winnerScore.rngState, Math.max(0, winnerScore.value - 3), winnerScore.value - 1);
  const homeWins = roll.value < p;
  return {
    value: homeWins ? { home: winnerScore.value, away: loserScore.value } : { home: loserScore.value, away: winnerScore.value },
    rngState: loserScore.rngState,
  };
}

/** Prépare le match de coupe du club. */
export function prepareCupMatch(state: GameState, tie: CupTie, round: number, live: boolean): { state: GameState; match: MatchState } {
  const seed = nextInt(state.meta.rngState, 0, 0xffffffff);
  const clubSide: Side = tie.home === MY_TEAM_ID ? 'home' : 'away';
  const opponent = teamById(state.league, clubSide === 'home' ? tie.away : tie.home)!;
  const clubTeam = { name: state.club.name, strength: null };
  const opponentTeam = { name: opponent.name, strength: opponent.strength };
  const { players, formation, lineup, style } = state.squad;
  const onField = effectiveLineup(players, formation, lineup);
  const match = createMatch({
    week: state.time.week,
    seed: seed.value,
    live,
    home: clubSide === 'home' ? clubTeam : opponentTeam,
    away: clubSide === 'home' ? opponentTeam : clubTeam,
    clubSide,
    onField,
    bench: benchOf(players, onField),
    style,
    strengthFactor: staffStrengthFactor(state),
    clubInjuryFactor: staffInjuryFactor(state),
  });
  return {
    state: { ...state, meta: { ...state.meta, rngState: seed.rngState } },
    match: { ...match, competition: 'cup', cupRound: round },
  };
}

function aiMatch(seed: number, home: Team, away: Team): { homeGoals: number; awayGoals: number } {
  const ctx: ClubContext = { players: [], formation: '4-4-2' };
  const done = simulateToEnd(
    createMatch({
      seed,
      live: false,
      home: { name: home.name, strength: home.strength },
      away: { name: away.name, strength: away.strength },
      clubSide: 'home',
      onField: [],
      bench: [],
      style: 'balanced',
    }),
    ctx,
  );
  return { homeGoals: done.score.home, awayGoals: done.score.away };
}

/** Recette d'un match de coupe à domicile : billetterie et bars, avec l'attrait d'un adversaire plus huppé. */
export function cupHomeRevenue(state: GameState, opponentId: string): { attendance: number; revenue: number } {
  const gap = Math.max(0, RANK[divisionOf(state.league, opponentId)] - RANK[state.league.myDivision]);
  const attraction = Math.min(balance.attraction.max, balance.attraction.base + gap * C.attractionPerDivision);
  const priceFactor = state.club.ticketPriceFactor;
  const attendance = attendanceFor(state.city, attraction, priceFactor).attendance;
  const ticket = Math.round(balance.economy.ticketPrice[state.league.myDivision] * priceFactor);
  const bars = barRates(state.city).reduce((sum, b) => sum + b.perSpectator, 0);
  return { attendance, revenue: attendance * ticket + Math.round(attendance * bars) };
}

/** Effets d'un match de coupe sur l'effectif : moral, blessures, statistiques (sans faire passer de semaine). */
function cupSquad(squad: Squad, match: MatchState): Squad {
  const morale = balance.morale;
  const delta = morale[clubOutcome(match)];
  const played = new Set(match.club.played);
  const injuries = new Map(match.injuries.map((i) => [i.playerId, i.weeks]));
  const players = squad.players.map(
    (p): Player => ({
      ...p,
      injuryWeeks: Math.max(p.injuryWeeks, injuries.get(p.id) ?? 0),
      morale: played.has(p.id) ? Math.min(morale.max, Math.max(morale.min, p.morale + delta)) : p.morale,
    }),
  );
  const next = { ...squad, players: applyMatchStats(players, match) };
  return next.autoLineup ? { ...next, lineup: autoLineup(next.players, next.formation) } : next;
}

/**
 * Joue tout le tour de la semaine (le match du club est fourni s'il a été joué en direct), règle
 * les tirs au but, encaisse recettes et primes, puis tire le tour suivant.
 */
export function completeCupRound(state: GameState, clubMatch: MatchState | null): { state: GameState; entries: LogEntry[] } {
  const round = cupRoundThisWeek(state);
  if (!round || !state.cup) return { state, entries: [] };
  let s = state;
  let rng = s.meta.rngState;
  const entries: LogEntry[] = [];
  const at = { season: s.time.season, week: s.time.week };
  let money = 0;
  const h2h: { opponent: string; myGoals: number; theirGoals: number }[] = [];
  let giantKillings = 0;

  const ties = round.ties.map((tie): CupTie => {
    const mine = tie.home === MY_TEAM_ID || tie.away === MY_TEAM_ID;
    let homeGoals: number;
    let awayGoals: number;
    let seed: number;
    let gkHome: number;
    let gkAway: number;
    if (mine && clubMatch) {
      homeGoals = clubMatch.score.home;
      awayGoals = clubMatch.score.away;
      seed = clubMatch.seed;
      const myGk = lineupStrength(s.squad.players, s.squad.formation, clubMatch.club.onField).gk;
      const other = teamById(s.league, tie.home === MY_TEAM_ID ? tie.away : tie.home)!;
      gkHome = tie.home === MY_TEAM_ID ? myGk : other.strength.gk;
      gkAway = tie.home === MY_TEAM_ID ? other.strength.gk : myGk;
    } else {
      const draw = nextInt(rng, 0, 0xffffffff);
      rng = draw.rngState;
      seed = draw.value;
      const home = teamById(s.league, tie.home)!;
      const away = teamById(s.league, tie.away)!;
      const r = aiMatch(seed, home, away);
      homeGoals = r.homeGoals;
      awayGoals = r.awayGoals;
      gkHome = home.strength.gk;
      gkAway = away.strength.gk;
    }
    let penalties: { home: number; away: number } | null = null;
    if (homeGoals === awayGoals) {
      const shootout = penaltyShootout(rng, gkHome, gkAway);
      rng = shootout.rngState;
      penalties = shootout.value;
    }
    const homeWins = penalties ? penalties.home > penalties.away : homeGoals > awayGoals;
    const winner = homeWins ? tie.home : tie.away;
    if (mine) {
      const opponent = tie.home === MY_TEAM_ID ? tie.away : tie.home;
      const myGoals = tie.home === MY_TEAM_ID ? homeGoals : awayGoals;
      const theirGoals = tie.home === MY_TEAM_ID ? awayGoals : homeGoals;
      h2h.push({ opponent, myGoals, theirGoals });
      if (winner === MY_TEAM_ID && RANK[divisionOf(s.league, opponent)] - RANK[s.league.myDivision] >= C.giantKillingGap) {
        giantKillings++;
      }
      if (tie.home === MY_TEAM_ID) money += cupHomeRevenue(s, opponent).revenue;
      if (winner === MY_TEAM_ID) money += C.prizes[round.round - 1] ?? 0;
      entries.push({
        ...at,
        key: 'cupResult',
        params: {
          round: round.round,
          opponent,
          home: tie.home === MY_TEAM_ID ? 1 : 0,
          scored: tie.home === MY_TEAM_ID ? homeGoals : awayGoals,
          conceded: tie.home === MY_TEAM_ID ? awayGoals : homeGoals,
          penaltiesFor: penalties ? (tie.home === MY_TEAM_ID ? penalties.home : penalties.away) : -1,
          penaltiesAgainst: penalties ? (tie.home === MY_TEAM_ID ? penalties.away : penalties.home) : -1,
          won: winner === MY_TEAM_ID ? 1 : 0,
        },
      });
    }
    return { ...tie, live: mine && clubMatch !== null && clubMatch.live, result: { homeGoals, awayGoals, penalties, winner, seed } };
  });

  // L'effectif garde les traces du match (moral, blessures, statistiques, buts au palmarès).
  if (clubMatch) {
    const names = new Map(s.squad.players.map((p) => [p.id, p.name]));
    s = { ...s, squad: cupSquad(s.squad, clubMatch), records: addGoals(s.records, clubMatch, names) };
  }

  const played: CupRound = { ...round, ties, played: true };
  const winners = ties.map((t) => t.result!.winner);
  let rounds = [...state.cup.rounds.slice(0, -1), played];
  let winner: string | null = null;
  if (round.round < C.weeks.length) {
    const entrants = round.round === 1 ? [...winners, ...state.cup.byes] : winners;
    const next = drawRound(rng, s.league, entrants, round.round + 1);
    rng = next.rngState;
    rounds = [...rounds, next.value];
  } else {
    winner = winners[0] ?? null;
  }

  for (const r of h2h) s = { ...s, records: addHeadToHead(s.records, r.opponent, r.myGoals, r.theirGoals) };
  s = { ...s, records: { ...s.records, giantKillings: s.records.giantKillings + giantKillings } };
  const treasury = s.club.treasury + money;
  const season = s.finance.season;
  const cupRuns = [...s.records.cupRuns.filter((r) => r.season !== s.time.season)];
  const myRun = played.ties.some((t) => t.home === MY_TEAM_ID || t.away === MY_TEAM_ID)
    ? { season: s.time.season, round: round.round, won: winner === MY_TEAM_ID }
    : s.records.cupRuns.find((r) => r.season === s.time.season);
  if (myRun) cupRuns.push(myRun);

  return {
    state: {
      ...s,
      meta: { ...s.meta, rngState: rng },
      club: { ...s.club, treasury },
      finance: { ...s.finance, season: { ...season, income: { ...season.income, cup: season.income.cup + money } } },
      records: {
        ...s.records,
        cupRuns,
        cups: winner === MY_TEAM_ID ? [...s.records.cups, s.time.season] : s.records.cups,
        bestTreasury: Math.max(s.records.bestTreasury, treasury),
      },
      cup: { ...state.cup, rounds, winner },
      currentMatch: null,
      log: [...s.log, ...entries],
    },
    entries,
  };
}

/**
 * Le tour de coupe de la semaine : en résumé, ou en direct à partir des quarts (ou toujours avec le réglage).
 * Renvoie le match en direct à jouer, s'il y en a un.
 */
export function playCupRound(state: GameState): { state: GameState; live: MatchState | null; entries: LogEntry[] } {
  const round = cupRoundThisWeek(state);
  if (!round) return { state, live: null, entries: [] };
  const tie = myTie(round);
  if (!tie) {
    const done = completeCupRound(state, null);
    return { state: done.state, live: null, entries: done.entries };
  }
  const live = state.settings.alwaysLiveMatches || round.round >= C.liveFromRound;
  const prepared = prepareCupMatch(state, tie, round.round, live);
  const ctx: ClubContext = { players: prepared.state.squad.players, formation: prepared.state.squad.formation };
  if (live) return { state: prepared.state, live: runMatch(prepared.match, ctx), entries: [] };
  const done = completeCupRound(prepared.state, simulateToEnd(prepared.match, ctx));
  return { state: done.state, live: null, entries: done.entries };
}
