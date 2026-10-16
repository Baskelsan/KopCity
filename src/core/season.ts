// La semaine de jeu : match du club (résumé ou direct), autres matchs, argent, ville, effectif,
// et les arrêts automatiques du bouton « Avancer » (voir docs/CADRAGE.md, « Boucle de jeu »).
import balance from '../data/balance.json';
import { progressConstructions } from './city';
import {
  addReports,
  netResult,
  nextSatisfaction,
  ticketPriceSupporterPenalty,
  nextSupporterShare,
  weekFinance,
} from './economy';
import { myDivision, myFixture, opponentOf, rankOf, recordResult, standings } from './league';
import { autoLineup, benchOf, effectiveLineup } from './lineup';
import { clubOutcome, createMatch, runMatch, simulateToEnd, type ClubContext } from './match';
import type { MatchState, Side } from './matchTypes';
import { completeCupRound, cupRoundThisWeek, playCupRound } from './cup';
import { homeStrengthFactor, wearEffects } from './effects';
import { rollEvent, settleCommitments } from './events';
import { endSeason, generateMarket } from './offseason';
import { applyMatchStats } from './playerStats';
import { addGoals, addHeadToHead } from './records';
import { nextInt } from './rng';
import { MY_TEAM_ID, type Alert, type Division, type GameState, type LogEntry, type Player, type Squad, type Team } from './state';

const K = balance.keyMatch;
const SEASON_WEEKS = balance.league.seasonWeeks;
const LOG_SIZE = 150;

export type KeyMatchReason = 'alwaysLive' | 'derby' | 'directRival' | 'promotion' | 'relegation' | 'cup';

const clubContext = (state: GameState): ClubContext => ({ players: state.squad.players, formation: state.squad.formation });

export function seasonOver(state: GameState): boolean {
  return state.phase === 'season' && state.time.week > SEASON_WEEKS;
}

/** Pourquoi le match de la semaine est un match à enjeu (liste vide : semaine calme). */
export function keyMatchReasons(state: GameState): KeyMatchReason[] {
  if (seasonOver(state)) return [];
  const division = myDivision(state.league);
  const week = state.time.week;
  const fixture = myFixture(division, week);
  if (!fixture) return [];
  const opponent = opponentOf(fixture);
  const reasons: KeyMatchReason[] = [];
  if (state.settings.alwaysLiveMatches) reasons.push('alwaysLive');
  if (opponent === state.league.rivalId) reasons.push('derby');

  const table = standings(division.table);
  const row = (team: string) => table.find((r) => r.team === team)!;
  const pointsAt = (rank: number) => table[rank - 1]?.points ?? 0;
  const me = row(MY_TEAM_ID);
  const myRank = rankOf(division.table, MY_TEAM_ID);

  if (week >= K.directRivalFromRound) {
    const gap = Math.abs(me.points - row(opponent).points);
    const rankGap = Math.abs(myRank - rankOf(division.table, opponent));
    if (gap <= K.directRivalMaxPointsGap && rankGap <= K.directRivalMaxRankGap) reasons.push('directRival');
  }

  const remaining = SEASON_WEEKS - week + 1;
  if (remaining <= K.finalRounds) {
    // « En jeu » : l'écart avec la ligne de montée ou de descente est d'au plus quelques points.
    const reachable = K.finalRoundsMaxPointsGap;
    const teams = table.length;
    const promotionLine = K.promotionSpots;
    const promotionAtStake =
      myRank > promotionLine
        ? pointsAt(promotionLine) - me.points <= reachable
        : me.points - pointsAt(promotionLine + 1) <= reachable;
    const relegationLine = teams - K.relegationSpots + 1;
    const relegationAtStake =
      myRank >= relegationLine
        ? pointsAt(relegationLine - 1) - me.points <= reachable
        : me.points - pointsAt(relegationLine) <= reachable;
    if (promotionAtStake) reasons.push('promotion');
    if (relegationAtStake) reasons.push('relegation');
  }
  return reasons;
}

/** Prépare le match de la semaine du club (graine tirée du générateur de la partie). */
function prepareMyMatch(state: GameState, live: boolean): { state: GameState; match: MatchState } {
  const division = myDivision(state.league);
  const fixture = myFixture(division, state.time.week);
  if (!fixture) throw new Error('Pas de match cette semaine');
  const opponent = division.teams.find((t) => t.id === opponentOf(fixture))!;
  const seed = nextInt(state.meta.rngState, 0, 0xffffffff);
  const clubSide: Side = fixture.home === MY_TEAM_ID ? 'home' : 'away';
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
    strengthFactor: clubSide === 'home' ? homeStrengthFactor(state) : 1,
  });
  return { state: { ...state, meta: { ...state.meta, rngState: seed.rngState } }, match };
}

/** Match entre deux adversaires : même moteur, en résumé, sans joueurs du club. */
export function simulateAiMatch(seed: number, home: Team, away: Team): { homeGoals: number; awayGoals: number } {
  const ctx: ClubContext = { players: [], formation: '4-4-2' };
  const match = createMatch({
    seed,
    live: false,
    home: { name: home.name, strength: home.strength },
    away: { name: away.name, strength: away.strength },
    clubSide: 'home',
    onField: [],
    bench: [],
    style: 'balanced',
  });
  const done = simulateToEnd(match, ctx);
  return { homeGoals: done.score.home, awayGoals: done.score.away };
}

/** Enregistre le résultat du club et joue tous les autres matchs de la journée, dans les 3 divisions. */
function playRound(state: GameState, match: MatchState): GameState {
  const week = state.time.week;
  let rng = state.meta.rngState;

  const divisions = state.league.divisions.map((division): Division => {
    const teams = new Map(division.teams.map((t) => [t.id, t]));
    let table = division.table;
    const fixtures = division.fixtures.map((f) => {
      if (f.week !== week) return f;
      if (f.home === MY_TEAM_ID || f.away === MY_TEAM_ID) {
        table = recordResult(table, f.home, f.away, match.score.home, match.score.away);
        return { ...f, result: { homeGoals: match.score.home, awayGoals: match.score.away, seed: match.seed }, live: match.live };
      }
      const seed = nextInt(rng, 0, 0xffffffff);
      rng = seed.rngState;
      const result = simulateAiMatch(seed.value, teams.get(f.home)!, teams.get(f.away)!);
      table = recordResult(table, f.home, f.away, result.homeGoals, result.awayGoals);
      return { ...f, result: { ...result, seed: seed.value } };
    });
    return { ...division, fixtures, table };
  });

  return { ...state, meta: { ...state.meta, rngState: rng }, league: { ...state.league, divisions } };
}

/** Blessés : une semaine de moins pour les anciens, puis les blessures et le moral du match. */
function updateSquad(squad: Squad, match: MatchState): Squad {
  const morale = balance.morale;
  const delta = morale[clubOutcome(match)];
  const played = new Set(match.club.played);
  const injuries = new Map(match.injuries.map((i) => [i.playerId, i.weeks]));
  const players = squad.players.map((p): Player => {
    const healed = Math.max(0, p.injuryWeeks - 1);
    const change = played.has(p.id) ? delta : morale.notPlayed;
    return {
      ...p,
      injuryWeeks: Math.max(healed, injuries.get(p.id) ?? 0),
      morale: Math.min(morale.max, Math.max(morale.min, p.morale + change)),
    };
  });
  const next = { ...squad, players: applyMatchStats(players, match) };
  return next.autoLineup ? { ...next, lineup: autoLineup(next.players, next.formation) } : next;
}

/**
 * Termine la semaine une fois le match du club joué : comptes, résultats, ville, effectif, semaine suivante.
 * Renvoie aussi les entrées ajoutées au journal cette semaine.
 */
export function completeWeek(state: GameState, match: MatchState): { state: GameState; entries: LogEntry[] } {
  const week = state.time.week;
  const fixture = myFixture(myDivision(state.league), week)!;
  const home = fixture.home === MY_TEAM_ID;
  const report = weekFinance(state, home ? fixture.away : null);
  const treasury = state.club.treasury + netResult(report);
  const weeksInRed = treasury < 0 ? state.club.weeksInRed + 1 : 0;
  const bankrupt = weeksInRed >= balance.bankruptcy.weeksInRed;

  // Palmarès : buts du club, meilleure affluence, plus grosse trésorerie.
  const names = new Map(state.squad.players.map((p) => [p.id, p.name]));
  const scored = addGoals(state.records, match, names);
  const opponent = opponentOf(fixture);
  const myGoals = match.score[match.club.side];
  const theirGoals = match.score[match.club.side === 'home' ? 'away' : 'home'];
  const withH2h = addHeadToHead(scored, opponent, myGoals, theirGoals);
  const recovered = state.club.weeksInRed >= balance.records.redRecoveryWeeks && weeksInRed === 0;
  const records = {
    ...withH2h,
    bestAttendance: Math.max(scored.bestAttendance, report.attendance ?? 0),
    bestTreasury: Math.max(scored.bestTreasury, treasury),
    redRecoveries: withH2h.redRecoveries + (recovered ? 1 : 0),
  };

  let next = playRound(state, match);
  next = {
    ...next,
    phase: bankrupt ? 'gameOver' : next.phase,
    gameOver: bankrupt ? { season: state.time.season, week } : next.gameOver,
    club: { ...next.club, treasury, weeksInRed },
    records,
    effects: wearEffects(next.effects, home),
    finance: { lastWeek: report, season: addReports(next.finance.season, report) },
    city: {
      ...next.city,
      supporterShare: Math.max(
        balance.supporters.min,
        nextSupporterShare(next.city.supporterShare, clubOutcome(match)) - ticketPriceSupporterPenalty(state, home),
      ),
      residentSatisfaction: nextSatisfaction(next.city),
    },
    squad: updateSquad(next.squad, match),
    currentMatch: null,
  };
  const logBefore = next.log.length;
  next = progressConstructions(next);
  const cityEntries = next.log.slice(logBefore);

  const result: LogEntry = {
    season: state.time.season,
    week,
    key: 'matchResult',
    params: {
      opponent: opponentOf(fixture),
      home: fixture.home === MY_TEAM_ID ? 1 : 0,
      scored: match.score[match.club.side],
      conceded: match.score[match.club.side === 'home' ? 'away' : 'home'],
    },
  };
  return {
    state: { ...next, log: [...next.log, result].slice(-LOG_SIZE), time: { ...next.time, week: week + 1 } },
    entries: [...cityEntries, result],
  };
}

/** Ce qui doit arrêter « Avancer » après une semaine jouée. */
export function weekAlerts(before: GameState, after: GameState, match: MatchState, entries: LogEntry[]): Alert[] {
  const alerts: Alert[] = [];
  for (const entry of entries) {
    if (entry.key === 'constructionDelivered' || entry.key === 'districtUnlocked') {
      alerts.push({ key: entry.key, params: entry.params });
    }
  }
  const starters = new Set(match.club.played);
  for (const injury of match.injuries) {
    if (starters.has(injury.playerId)) alerts.push({ key: 'starterInjured', params: { playerId: injury.playerId, weeks: injury.weeks } });
  }
  if (after.club.treasury < 0) {
    alerts.push({ key: 'treasuryNegative', params: { treasury: after.club.treasury, weeks: after.club.weeksInRed } });
  }
  const threshold = balance.satisfaction.alertBelow;
  if (before.city.residentSatisfaction >= threshold && after.city.residentSatisfaction < threshold) {
    alerts.push({ key: 'lowSatisfaction', params: { satisfaction: after.city.residentSatisfaction } });
  }
  if (seasonOver(after)) alerts.push({ key: 'seasonOver' });
  if (after.phase === 'gameOver') alerts.push({ key: 'bankruptcy' });
  return alerts;
}

/**
 * « Avancer » : enchaîne les semaines calmes (match en résumé) et s'arrête de lui-même
 * avant un match à enjeu (joué en direct), à l'ouverture du mercato d'hiver,
 * ou après une semaine qui demande l'attention du joueur. Après la dernière journée, il ouvre l'intersaison.
 */
export function advance(state: GameState): GameState {
  if (state.currentMatch || state.phase !== 'season' || state.events.pending) return state;
  // Repartir referme le mercato d'hiver.
  let s: GameState = { ...state, alerts: [], market: { ...state.market, open: false, offers: [] } };
  for (;;) {
    if (seasonOver(s)) return endSeason(settleCommitments(s).state);
    // Un événement peut tomber au début de la semaine : il faut y répondre avant de jouer.
    s = rollEvent(s);
    if (s.events.pending) return { ...s, alerts: [{ key: 'event', params: { eventId: s.events.pending.eventId } }] };
    if (s.time.week === balance.market.winterWeek && s.market.lastWinterSeason !== s.time.season) {
      const offers = generateMarket(s.meta.rngState, s.league.myDivision);
      return {
        ...s,
        meta: { ...s.meta, rngState: offers.rngState },
        market: { offers: offers.value, open: true, lastWinterSeason: s.time.season },
        alerts: [{ key: 'winterMarket' }],
      };
    }
    // Le tour de coupe de la semaine se joue avant le championnat (en direct à partir des quarts).
    if (cupRoundThisWeek(s)) {
      const cup = playCupRound(s);
      if (cup.live) return { ...cup.state, currentMatch: cup.live, alerts: [{ key: 'keyMatch', params: { reasons: 'cup' } }] };
      s = cup.state;
    }
    const reasons = keyMatchReasons(s);
    if (reasons.length > 0) {
      const prepared = prepareMyMatch(s, true);
      const live = runMatch(prepared.match, clubContext(prepared.state));
      return { ...prepared.state, currentMatch: live, alerts: [{ key: 'keyMatch', params: { reasons: reasons.join(',') } }] };
    }
    const prepared = prepareMyMatch(s, false);
    const played = simulateToEnd(prepared.match, clubContext(prepared.state));
    const week = completeWeek(prepared.state, played);
    const alerts = weekAlerts(s, week.state, played, week.entries);
    s = { ...week.state, alerts };
    if (alerts.length > 0 || s.phase !== 'season') return s;
  }
}

/** Fin d'un match joué en direct : la semaine se termine comme une semaine calme (ou le tour de coupe se clôt). */
export function finishLiveMatch(state: GameState): GameState {
  const match = state.currentMatch;
  if (!match?.finished) return state;
  if (match.competition === 'cup') {
    const done = completeCupRound(state, match);
    const injured = match.injuries
      .filter((i) => match.club.played.includes(i.playerId))
      .map((i): Alert => ({ key: 'starterInjured', params: { playerId: i.playerId, weeks: i.weeks } }));
    return { ...done.state, alerts: [{ key: 'cupResult', params: done.entries[0]?.params }, ...injured] };
  }
  const week = completeWeek(state, match);
  return { ...week.state, alerts: weekAlerts(state, week.state, match, week.entries) };
}
