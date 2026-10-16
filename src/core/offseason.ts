// Fin de saison et intersaison : montées et descentes, prime, évolution des équipes et des joueurs,
// contrats, jeunes du centre de formation, mercato, puis lancement de la saison suivante.
import balance from '../data/balance.json';
import { academyLevel, unlockDistricts } from './city';
import { emptyReport, netResult } from './economy';
import { divisionAbove, divisionBelow, DIVISIONS, newSeasonDivision, pickRival, rankOf, standings } from './league';
import { autoLineup } from './lineup';
import {
  divisionLevel,
  floatBetween,
  generatePlayer,
  contractSalary,
  lineRating,
  overall,
  saleValue,
  transferValue,
  weightedPosition,
} from './players';
import { nextChance, nextInt, type Draw } from './rng';
import {
  MY_TEAM_ID,
  type Alert,
  type Division,
  type DivisionId,
  type GameState,
  type MarketOffer,
  type Movement,
  type Player,
  type PlayerStats,
  type RaiseRequest,
  type RatingChange,
  type Squad,
  type Team,
} from './state';
import { drawObjectives, evaluateObjectives, sponsorMultiplierFor } from './objectives';
import { beatenRecords, markSeasonStart } from './records';
import { strengthForLevel } from './strength';

const AG = balance.aging;
const AC = balance.academy;
const MK = balance.market;
const SZ = balance.squadSize;
const STAT_KEYS: (keyof PlayerStats)[] = ['att', 'def', 'pas', 'phy'];
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ——— Montées et descentes ———

/** Prime de fin de saison : 100 % pour le premier, puis régulièrement jusqu'à 20 % pour le dernier. */
export function seasonBonus(division: DivisionId, rank: number, teams: number): number {
  const S = balance.seasonEnd;
  const factor = 1 - ((rank - 1) * (1 - S.bonusLastFactor)) / (teams - 1);
  return Math.round(S.bonusFirst[division] * factor);
}

/** Échange les 2 derniers d'une division avec les 2 premiers de celle du dessous. */
function promoteAndRelegate(divisions: Division[]): { divisions: Map<DivisionId, string[]> } {
  const spots = balance.keyMatch;
  const members = new Map<DivisionId, string[]>();
  for (const d of divisions) members.set(d.id, standings(d.table).map((r) => r.team));
  const next = new Map<DivisionId, string[]>();
  for (const d of DIVISIONS) next.set(d, [...members.get(d)!]);
  for (const lower of DIVISIONS) {
    const upper = divisionAbove(lower);
    if (!upper) continue;
    const up = members.get(lower)!.slice(0, spots.promotionSpots);
    const upperOrder = members.get(upper)!;
    const down = upperOrder.slice(upperOrder.length - spots.relegationSpots);
    next.set(lower, next.get(lower)!.filter((t) => !up.includes(t)).concat(down));
    next.set(upper, next.get(upper)!.filter((t) => !down.includes(t)).concat(up));
  }
  return { divisions: next };
}

/** Le niveau d'une équipe dérive un peu, avec un rappel vers celui de sa (nouvelle) division. */
function evolveTeam(rngState: number, team: Team, division: DivisionId): Draw<Team> {
  const T = balance.teams;
  const noise = floatBetween(rngState, -T.levelNoise, T.levelNoise);
  const level = team.level + T.levelReversion * (divisionLevel(division) - team.level) + noise.value;
  const strength = strengthForLevel(noise.rngState, level);
  return { value: { ...team, level, strength: strength.value }, rngState: strength.rngState };
}

// ——— Joueurs ———

/** Vieillissement : progression des jeunes vers leur potentiel, stabilité, puis déclin. */
export function agePlayer(rngState: number, player: Player, academy: number): Draw<Player> {
  let rng = rngState;
  const age = player.age + 1;
  const stats = { ...player.stats };
  if (age <= AG.youngMaxAge) {
    const bonus = player.homegrown ? academy * AG.academyBonusPerLevel : 0;
    for (const key of STAT_KEYS) {
      const gain = nextInt(rng, AG.youngGainMin, AG.youngGainMax);
      rng = gain.rngState;
      stats[key] = clamp(stats[key] + gain.value + bonus, 1, 20);
    }
    // On ne dépasse pas le potentiel : la progression est ramenée à ce qu'il permet.
    const before = lineRating(player, player.pos);
    const after = lineRating({ ...player, stats }, player.pos);
    if (after > player.potential && after > before) {
      const keep = Math.max(0, (player.potential - before) / (after - before));
      for (const key of STAT_KEYS) {
        stats[key] = clamp(player.stats[key] + Math.floor((stats[key] - player.stats[key]) * keep), 1, 20);
      }
    }
  } else if (age >= AG.declineFromAge) {
    for (const key of STAT_KEYS) {
      const loss = nextInt(rng, AG.declineMin, AG.declineMax);
      rng = loss.rngState;
      stats[key] = clamp(stats[key] - loss.value, 1, 20);
    }
  }
  return { value: { ...player, age, stats }, rngState: rng };
}

/** Retraite : obligatoire à 38 ans, possible dès 35. */
function retires(rngState: number, player: Player): Draw<boolean> {
  if (player.age >= AG.retireAge) return { value: true, rngState };
  if (player.age < AG.retireFromAge) return { value: false, rngState };
  return nextChance(rngState, AG.retireChance);
}

/** Jeunes sortis du centre : leur nombre et leur potentiel montent avec le niveau du centre et la population. */
export function generateProspects(
  rngState: number,
  level: number,
  population: number,
  extraPotential = 0,
  fixedCount?: number,
): Draw<Player[]> {
  let rng = rngState;
  const [min, max] = AC.prospectsByLevel[clamp(level, 0, AC.prospectsByLevel.length - 1)]!;
  const count = fixedCount !== undefined ? { value: fixedCount, rngState: rng } : nextInt(rng, min!, max!);
  rng = count.rngState;
  const prospects: Player[] = [];
  for (let i = 0; i < count.value; i++) {
    const pos = weightedPosition(rng, AC.positionWeights);
    const spread = floatBetween(pos.rngState, -AC.potentialSpread, AC.potentialSpread);
    rng = spread.rngState;
    const potential =
      AC.potentialBase + level * AC.potentialPerLevel + population * AC.potentialPerPopulation + spread.value + extraPotential;
    const draw = generatePlayer(rng, pos.value, AC.currentLevel + level * AC.currentLevelPerLevel, {
      ageMin: AC.ageMin,
      ageMax: AC.ageMax,
      potential,
      starsErrorFactor: Math.max(0, 1 - level * AC.starsErrorReductionPerLevel),
      homegrown: true,
      contractYears: AC.contractYears,
    });
    rng = draw.rngState;
    prospects.push(draw.value);
  }
  return { value: prospects, rngState: rng };
}

/** Joueurs proposés au mercato, au niveau de la division du club. */
export function generateMarket(rngState: number, division: DivisionId): Draw<MarketOffer[]> {
  let rng = rngState;
  const count = nextInt(rng, MK.offersMin, MK.offersMax);
  rng = count.rngState;
  const offers: MarketOffer[] = [];
  for (let i = 0; i < count.value; i++) {
    const pos = weightedPosition(rng, balance.players.squadComposition);
    const spread = floatBetween(pos.rngState, -MK.levelSpread, MK.levelSpread);
    const draw = generatePlayer(spread.rngState, pos.value, divisionLevel(division) + spread.value);
    rng = draw.rngState;
    const player = { ...draw.value, monthlySalary: contractSalary(draw.value, division) };
    offers.push({ player, price: transferValue(player) });
  }
  return { value: offers, rngState: rng };
}

// ——— Fin de saison ———

/**
 * Clôt la saison : prime, montées et descentes, évolution des équipes et des joueurs,
 * contrats qui arrivent à échéance, jeunes du centre, mercato. Le jeu passe en intersaison.
 */
export function endSeason(state: GameState): GameState {
  let rng = state.meta.rngState;
  const myDiv = state.league.myDivision;
  const mine = state.league.divisions.find((d) => d.id === myDiv)!;
  const rank = rankOf(mine.table, MY_TEAM_ID);
  const bonus = seasonBonus(myDiv, rank, mine.table.length);

  // Montées et descentes, pour le club comme pour les adversaires.
  const allTeams = new Map(state.league.divisions.flatMap((d) => d.teams.map((t) => [t.id, t] as const)));
  const { divisions: members } = promoteAndRelegate(state.league.divisions);
  const newDivision = DIVISIONS.find((d) => members.get(d)!.includes(MY_TEAM_ID))!;
  const movement: Movement =
    newDivision === divisionAbove(myDiv) ? 'promoted' : newDivision === divisionBelow(myDiv) ? 'relegated' : 'stayed';

  const divisions: Division[] = [];
  for (const id of DIVISIONS) {
    const teams: Team[] = [];
    for (const teamId of members.get(id)!) {
      if (teamId === MY_TEAM_ID) continue;
      const evolved = evolveTeam(rng, allTeams.get(teamId)!, id);
      rng = evolved.rngState;
      teams.push(evolved.value);
    }
    // Calendrier et classement repartent de zéro au lancement de la saison suivante ; on garde l'ancien ici.
    const old = state.league.divisions.find((d) => d.id === id)!;
    divisions.push({ ...old, teams });
  }

  // Joueurs : âge, progression, retraite ; contrats qui avancent d'une saison.
  const academy = academyLevel(state.city);
  const retired: string[] = [];
  const ratingChanges: RatingChange[] = [];
  const players: Player[] = [];
  for (const p of state.squad.players) {
    const aged = agePlayer(rng, p, academy);
    rng = aged.rngState;
    ratingChanges.push({ playerId: p.id, name: p.name, age: aged.value.age, before: overall(p), after: overall(aged.value) });
    const retire = retires(rng, aged.value);
    rng = retire.rngState;
    if (retire.value) {
      retired.push(p.name);
      ratingChanges.pop();
      continue;
    }
    const target = balance.offseason.moraleTarget;
    players.push({
      ...aged.value,
      contractYears: Math.max(0, aged.value.contractYears - 1),
      injuryWeeks: 0,
      morale: Math.round(aged.value.morale + (target - aged.value.morale) * balance.offseason.moraleRecovery),
    });
  }

  const R = balance.raises;
  const raiseRequests: RaiseRequest[] = players
    .filter((p) => p.contractYears > 0 && p.seasonStats.apps >= R.minApps)
    .filter((p) => p.seasonStats.ratingTotal / p.seasonStats.apps >= R.minAverageRating)
    .map((p) => ({ playerId: p.id, salary: Math.round((p.monthlySalary * R.factor) / 100) * 100 }));

  const prospects = generateProspects(rng, academy, state.city.population);
  rng = prospects.rngState;
  const market = generateMarket(rng, newDivision);
  rng = market.rngState;

  const unlock = unlockDistricts(state.city, newDivision);
  const at = { season: state.time.season, week: state.time.week };
  const log = [
    ...state.log,
    { ...at, key: 'seasonEnd', params: { division: myDiv, rank, movement, bonus } },
    ...unlock.unlocked.map((district) => ({ ...at, key: 'districtUnlocked', params: { district } })),
  ];
  const alerts: Alert[] = unlock.unlocked.map((district) => ({ key: 'districtUnlocked', params: { district } }));

  // Objectifs, palmarès et records de la saison.
  const objectiveResults = evaluateObjectives(state, myDiv);
  const rewards = objectiveResults.reduce((sum, r) => sum + r.reward, 0);
  const treasury = state.club.treasury + bonus + rewards;
  const records = {
    ...state.records,
    titles: rank === 1 ? [...state.records.titles, { season: state.time.season, division: myDiv }] : state.records.titles,
    promotions: state.records.promotions + (movement === 'promoted' ? 1 : 0),
    history: [...state.records.history, { season: state.time.season, division: myDiv, rank }],
    bestTreasury: Math.max(state.records.bestTreasury, treasury),
  };

  return {
    ...state,
    phase: 'offseason',
    meta: { ...state.meta, rngState: rng },
    club: { ...state.club, treasury },
    objectives: [],
    records,
    city: unlock.city,
    league: { ...state.league, myDivision: newDivision, divisions },
    squad: cleanLineup({ ...state.squad, players }),
    market: { ...state.market, offers: market.value, open: true },
    offseason: {
      summary: { season: state.time.season, division: myDiv, rank, bonus, movement, net: netResult(state.finance.season) },
      prospects: prospects.value,
      retired,
      ratingChanges,
      objectiveResults,
      recordsBeaten: beatenRecords(records),
      raiseRequests,
    },
    log,
    alerts,
  };
}

/** Joueurs sous contrat : un joueur en fin de contrat non prolongé ne compte plus dans l'effectif. */
export function contractedPlayers(players: readonly Player[]): Player[] {
  return players.filter((p) => p.contractYears > 0);
}

/**
 * Retire de la composition les joueurs partis ou en fin de contrat, et la recalcule si elle est automatique.
 */
function cleanLineup(squad: Squad): Squad {
  const active = contractedPlayers(squad.players);
  const ids = new Set(active.map((p) => p.id));
  if (squad.autoLineup) return { ...squad, lineup: autoLineup(active, squad.formation) };
  return { ...squad, lineup: squad.lineup.map((id) => (ids.has(id) ? id : '')) };
}

// ——— Décisions de l'intersaison et du mercato ———

export type SquadRefusal = 'squadFull' | 'squadTooSmall' | 'notEnoughMoney' | 'marketClosed' | 'unknown';
export type SquadCheck = { ok: true } | { ok: false; reason: SquadRefusal };

/** Joueurs en fin de contrat : ils partiront au lancement de la saison s'ils ne sont pas prolongés. */
export function expiringPlayers(state: GameState): Player[] {
  return state.phase === 'offseason' ? state.squad.players.filter((p) => p.contractYears <= 0) : [];
}

/** Effectif au lancement de la saison : sans les contrats non prolongés. */
export function squadSizeAtStart(state: GameState): number {
  return state.squad.players.length - expiringPlayers(state).length;
}

export function renewalSalary(player: Player, division: DivisionId): number {
  return Math.round((contractSalary(player, division) * balance.contracts.renewalSalaryFactor) / 100) * 100;
}

export function renewContract(state: GameState, playerId: string, years: number): GameState {
  const C = balance.contracts;
  if (state.phase !== 'offseason' || years < C.yearsMin || years > C.yearsMax) return state;
  const player = state.squad.players.find((p) => p.id === playerId);
  if (!player || player.contractYears > 0) return state;
  const players = state.squad.players.map((p) =>
    p.id === playerId ? { ...p, contractYears: years, monthlySalary: renewalSalary(p, state.league.myDivision) } : p,
  );
  return { ...state, squad: cleanLineup({ ...state.squad, players }) };
}

export function canAddPlayer(state: GameState, price = 0): SquadCheck {
  if (!(state.phase === 'offseason' || state.market.open)) return { ok: false, reason: 'marketClosed' };
  if (contractedPlayers(state.squad.players).length >= SZ.max) return { ok: false, reason: 'squadFull' };
  if (state.club.treasury - price < 0) return { ok: false, reason: 'notEnoughMoney' };
  return { ok: true };
}

export function canRemovePlayer(state: GameState): SquadCheck {
  if (!(state.phase === 'offseason' || state.market.open)) return { ok: false, reason: 'marketClosed' };
  if (contractedPlayers(state.squad.players).length <= SZ.min) return { ok: false, reason: 'squadTooSmall' };
  return { ok: true };
}

function addPlayer(state: GameState, player: Player): Squad {
  return cleanLineup({ ...state.squad, players: [...state.squad.players, player] });
}

export function signProspect(state: GameState, playerId: string): GameState {
  const prospect = state.offseason?.prospects.find((p) => p.id === playerId);
  if (!prospect || !canAddPlayer(state).ok) return state;
  return {
    ...state,
    squad: addPlayer(state, prospect),
    offseason: { ...state.offseason!, prospects: state.offseason!.prospects.filter((p) => p.id !== playerId) },
  };
}

export function declineProspect(state: GameState, playerId: string): GameState {
  if (!state.offseason) return state;
  return { ...state, offseason: { ...state.offseason, prospects: state.offseason.prospects.filter((p) => p.id !== playerId) } };
}

export function buyPlayer(state: GameState, playerId: string): GameState {
  const offer = state.market.offers.find((o) => o.player.id === playerId);
  if (!offer || !canAddPlayer(state, offer.price).ok) return state;
  return {
    ...state,
    club: { ...state.club, treasury: state.club.treasury - offer.price },
    squad: addPlayer(state, offer.player),
    market: { ...state.market, offers: state.market.offers.filter((o) => o.player.id !== playerId) },
  };
}

export function sellPlayer(state: GameState, playerId: string): GameState {
  const player = state.squad.players.find((p) => p.id === playerId);
  if (!player || player.contractYears <= 0 || !canRemovePlayer(state).ok) return state;
  return {
    ...state,
    club: { ...state.club, treasury: state.club.treasury + saleValue(player) },
    squad: cleanLineup({ ...state.squad, players: state.squad.players.filter((p) => p.id !== playerId) }),
  };
}

function refuseRaiseMorale(player: Player): Player {
  const m = balance.morale;
  return { ...player, morale: Math.min(m.max, Math.max(m.min, player.morale + balance.raises.refusedMorale)) };
}

/** Répondre à une demande d'augmentation : accepter (nouveau salaire) ou refuser (moral −20). */
export function answerRaise(state: GameState, playerId: string, accept: boolean): GameState {
  const request = state.offseason?.raiseRequests.find((r) => r.playerId === playerId);
  if (!request || !state.offseason) return state;
  const players = state.squad.players.map((p) =>
    p.id !== playerId ? p : accept ? { ...p, monthlySalary: request.salary } : refuseRaiseMorale(p),
  );
  return {
    ...state,
    squad: { ...state.squad, players },
    offseason: { ...state.offseason, raiseRequests: state.offseason.raiseRequests.filter((r) => r.playerId !== playerId) },
  };
}

/** Peut-on lancer la saison ? L'effectif, sans les contrats non prolongés, doit compter de 16 à 22 joueurs. */
export function canStartSeason(state: GameState): SquadCheck {
  const size = squadSizeAtStart(state);
  if (size < SZ.min) return { ok: false, reason: 'squadTooSmall' };
  if (size > SZ.max) return { ok: false, reason: 'squadFull' };
  return { ok: true };
}

/** Lance la saison suivante : départs des contrats non prolongés, nouveaux calendriers, comptes à zéro. */
export function startSeason(state: GameState): GameState {
  if (state.phase !== 'offseason' || !canStartSeason(state).ok) return state;
  let rng = state.meta.rngState;
  const leaving = new Set(expiringPlayers(state).map((p) => p.id));
  const unanswered = new Set((state.offseason?.raiseRequests ?? []).map((r) => r.playerId));
  const players = state.squad.players
    .filter((p) => !leaving.has(p.id))
    .map((p) => (unanswered.has(p.id) ? refuseRaiseMorale(p) : p))
    .map((p) => ({ ...p, seasonStats: { apps: 0, goals: 0, assists: 0, ratingTotal: 0 } }));

  const divisions: Division[] = [];
  for (const old of state.league.divisions) {
    const withClub = old.id === state.league.myDivision;
    const draw = newSeasonDivision(rng, old.id, old.teams, withClub);
    rng = draw.rngState;
    divisions.push(draw.value);
  }
  const mine = divisions.find((d) => d.id === state.league.myDivision)!;
  const rival = pickRival(rng, mine);
  rng = rival.rngState;
  const objectives = drawObjectives(rng);
  rng = objectives.rngState;
  const sponsorMultiplier = sponsorMultiplierFor(state.offseason?.objectiveResults ?? []);

  return {
    ...state,
    phase: 'season',
    meta: {
      ...state.meta,
      rngState: rng,
      playTime: { ...state.meta.playTime, season: 0, lastSeason: state.meta.playTime.season },
    },
    time: { season: state.time.season + 1, week: 1 },
    club: { ...state.club, weeksInRed: state.club.treasury < 0 ? state.club.weeksInRed : 0, sponsorMultiplier },
    objectives: objectives.value,
    records: markSeasonStart(state.records),
    squad: cleanLineup({ ...state.squad, players }),
    league: { ...state.league, divisions, rivalId: rival.value },
    market: { ...state.market, offers: [], open: false },
    finance: { lastWeek: null, season: emptyReport() },
    offseason: null,
    alerts: [],
  };
}
