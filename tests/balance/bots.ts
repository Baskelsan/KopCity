// Joueurs automatiques pour l'équilibrage : ils jouent avec les mêmes actions que le vrai joueur.
import balance from '../../src/data/balance.json';
import {
  allSlots,
  attendanceForCheck,
  canBuild,
  canExtendStadium,
  canUpgrade,
  stadiumCapacity,
} from './cityHelpers';
import { upkeepAt } from '../../src/core/city';
import { choiceRefusal, eventSpec } from '../../src/core/events';
import { applyAction, newGame, type Action } from '../../src/core/game';
import { formationSlots } from '../../src/core/lineup';
import { defaultDecision } from '../../src/core/match';
import { canAddPlayer, contractedPlayers, expiringPlayers, startingElevenLevel } from '../../src/core/offseason';
import { divisionLevel, lineRating, overall } from '../../src/core/players';
import type { BuildingType, ConstructionType, GameState, Position } from '../../src/core/state';

export type StrategyName = 'stadium' | 'players' | 'balanced' | 'max';

export interface Strategy {
  name: StrategyName;
  /** Argent gardé de côté, jamais dépensé. */
  reserve: number;
  /** Dépenses en ville après chaque arrêt. */
  build: (state: GameState) => GameState;
  /** Achats de joueurs quand le mercato est ouvert. */
  recruit: (state: GameState) => GameState;
  /** Réponse à un événement. */
  eventChoice: (state: GameState) => string;
  /** Accepte les demandes d'augmentation à l'intersaison. */
  acceptRaises: boolean;
}

const run = (state: GameState, action: Action) => applyAction(state, action);

function firstAllowedChoice(state: GameState): string {
  const spec = eventSpec(state.events.pending!.eventId);
  return spec.choices.find((c) => choiceRefusal(state, c) === null)!.id;
}

/** Construit le premier bâtiment possible de la liste, sur le premier emplacement libre qui l'accepte. */
function buildFirst(state: GameState, types: BuildingType[], reserve: number): GameState {
  for (const type of types) {
    for (const { slot } of allSlots(state.city)) {
      const check = canBuild(state, slot.id, type);
      if (check.ok && state.club.treasury - check.cost >= reserve) return run(state, { type: 'build', slotId: slot.id, building: type });
    }
  }
  return state;
}

/** Note du plus faible titulaire à un poste. */
function weakestStarter(state: GameState, pos: Position): number {
  const byId = new Map(state.squad.players.map((p) => [p.id, p]));
  const slots = formationSlots(state.squad.formation);
  const ratings = state.squad.lineup
    .map((id, i) => ({ p: byId.get(id), line: slots[i] }))
    .filter((x) => x.line === pos && x.p)
    .map((x) => lineRating(x.p!, pos));
  return ratings.length ? Math.min(...ratings) : 0;
}

/** Achète les joueurs du marché qui améliorent le onze, tant que l'argent (au-dessus de la réserve) le permet. */
function buyUpgrades(state: GameState, reserve: number, minGain: number, salaryMonthsKept = 0): GameState {
  let s = state;
  const offers = [...s.market.offers].sort((a, b) => overall(b.player) - overall(a.player));
  for (const offer of offers) {
    const gain = lineRating(offer.player, offer.player.pos) - weakestStarter(s, offer.player.pos);
    if (gain < minGain) continue;
    const keep = reserve + salaryMonthsKept * offer.player.monthlySalary;
    if (!canAddPlayer(s, offer.price).ok || s.club.treasury - offer.price < keep) continue;
    s = run(s, { type: 'buyPlayer', playerId: offer.player.id });
  }
  return s;
}

export const STRATEGIES: Record<StrategyName, Strategy> = {
  /** Tout sur le stade : agrandir dès que possible, des bars partout, aucun recrutement. */
  stadium: {
    name: 'stadium',
    reserve: 0,
    build: (state) => {
      let s = state;
      for (let i = 0; i < 3; i++) {
        const check = canExtendStadium(s);
        if (check.ok && s.club.treasury - check.cost >= 0) s = run(s, { type: 'extendStadium' });
        else s = buildFirst(s, ['bar'], 0);
      }
      return s;
    },
    recruit: (state) => state,
    eventChoice: (state) => (state.events.pending!.eventId === 'playerOffer' ? 'sell' : firstAllowedChoice(state)),
    acceptRaises: false,
  },

  /** Tout sur les joueurs : chaque euro va au mercato, rien n'est construit. */
  players: {
    name: 'players',
    reserve: 0,
    build: (state) => state,
    recruit: (state) => buyUpgrades(state, 0, 0.5),
    eventChoice: (state) => (state.events.pending!.eventId === 'playerOffer' ? 'refuse' : firstAllowedChoice(state)),
    acceptRaises: true,
  },

  /** Équilibré : une ville qui grandit, un stade agrandi quand il est plein, des renforts ciblés, une réserve. */
  balanced: {
    name: 'balanced',
    reserve: 250000,
    build: (state) => {
      let s = state;
      const reserve = 250000;
      const order: BuildingType[] = ['shop', 'housing', 'transport', 'academy', 'bar', 'park', 'fanzone'];
      s = buildFirst(s, order, reserve);
      // Agrandir le stade quand il limite l'affluence.
      const d = attendanceForCheck(s);
      const check = canExtendStadium(s);
      if (d.limitedBy === 'capacity' && check.ok && s.club.treasury - check.cost >= reserve) s = run(s, { type: 'extendStadium' });
      // Monter le centre de formation et les logements.
      for (const { slot } of allSlots(s.city)) {
        if (slot.building?.type !== 'academy' && slot.building?.type !== 'housing') continue;
        const up = canUpgrade(s, slot.id);
        if (up.ok && s.club.treasury - up.cost >= reserve * 2) s = run(s, { type: 'upgradeBuilding', slotId: slot.id });
      }
      return s;
    },
    recruit: (state) => buyUpgrades(state, 250000, 0.5),
    eventChoice: (state) => (state.events.pending!.eventId === 'playerOffer' ? 'refuse' : firstAllowedChoice(state)),
    acceptRaises: true,
  },

  /**
   * À fond : centre de formation au maximum le plus tôt possible, toute la ville améliorée,
   * tous les jeunes signés, les meilleurs joueurs achetés, toutes les augmentations acceptées.
   */
  max: {
    name: 'max',
    reserve: 100000,
    build: (state) => {
      let s = state;
      const reserve = 100000;
      // Prudent : garde de quoi payer une demi-saison du nouvel entretien.
      const keep = (type: ConstructionType, level: number) => reserve + 26 * (upkeepAt(type, level) - upkeepAt(type, level - 1));
      s = buildFirst(s, ['academy', 'shop', 'housing', 'transport', 'bar', 'fanzone', 'park'], reserve);
      s = buildFirst(s, ['training'], keep('training', 1));
      s = buildFirst(s, ['museum'], keep('museum', 1));
      for (const { slot } of allSlots(s.city)) {
        if (!slot.building) continue;
        const up = canUpgrade(s, slot.id);
        if (up.ok && s.club.treasury - up.cost >= keep(slot.building.type, slot.building.level + 1)) {
          s = run(s, { type: 'upgradeBuilding', slotId: slot.id });
        }
      }
      const d = attendanceForCheck(s);
      const check = canExtendStadium(s);
      const stadiumKeep = keep('stadium', s.city.stadiumLevel + 1);
      if (d.limitedBy === 'capacity' && check.ok && s.club.treasury - check.cost >= stadiumKeep) s = run(s, { type: 'extendStadium' });
      // Staff au complet au-delà de 3 M€, licencié sous 1 M€.
      const hire = s.club.treasury > 3_000_000;
      const fire = s.club.treasury < 1_000_000;
      for (const role of ['physio', 'scout', 'analyst'] as const) {
        if ((hire && !s.staff[role]) || (fire && s.staff[role])) s = run(s, { type: 'setStaff', role, hired: hire });
      }
      return s;
    },
    // Achète seulement s'il reste de quoi payer une saison de salaire du joueur.
    recruit: (state) => buyUpgrades(state, 100000, 0.5, 12),
    eventChoice: (state) => (state.events.pending!.eventId === 'playerOffer' ? 'refuse' : firstAllowedChoice(state)),
    acceptRaises: true,
  },
};

export interface SeasonStats {
  stops: number;
  liveMatches: number;
  events: number;
  /** Nombre d'arrêts par raison (une raison par arrêt : la première de la liste). */
  reasons: Record<string, number>;
}

export interface GameResult {
  strategy: StrategyName;
  seasonsPlayed: number;
  bankrupt: boolean;
  finalDivision: string;
  bestDivision: string;
  titles: number;
  promotions: number;
  treasury: number;
  satisfaction: number;
  bestAttendance: number;
  capacity: number;
  population: number;
  seasons: SeasonStats[];
  /** Fin de chaque saison : niveau du onze, trésorerie, division, champion ou non. */
  perSeason: { level: number; treasury: number; division: string; champion: boolean }[];
}

/** Intersaison : prolonger les bons joueurs, signer les jeunes, recruter, compléter si besoin, lancer la saison. */
function playOffseason(state: GameState, strategy: Strategy): GameState {
  let s = state;
  const level = divisionLevel(s.league.myDivision);
  for (const p of expiringPlayers(s)) {
    if (p.age <= 33 && overall(p) >= level - 3) s = run(s, { type: 'renewContract', playerId: p.id, years: 2 });
  }
  for (const r of [...s.offseason!.raiseRequests]) {
    s = run(s, { type: 'answerRaise', playerId: r.playerId, accept: strategy.acceptRaises });
  }
  for (const p of s.offseason!.prospects) s = run(s, { type: 'signProspect', playerId: p.id });
  s = strategy.recruit(s);
  // Toujours de quoi lancer la saison : prolonger, puis acheter le moins cher.
  for (const p of expiringPlayers(s)) {
    if (contractedPlayers(s.squad.players).length >= balance.squadSize.min) break;
    s = run(s, { type: 'renewContract', playerId: p.id, years: 1 });
  }
  const cheapest = [...s.market.offers].sort((a, b) => a.price - b.price);
  for (const offer of cheapest) {
    if (contractedPlayers(s.squad.players).length >= balance.squadSize.min) break;
    s = run(s, { type: 'buyPlayer', playerId: offer.player.id });
  }
  s = strategy.build(s);
  return run(s, { type: 'startSeason' });
}

export function playGame(seed: number, strategy: Strategy, seasons: number): GameResult {
  let s = applyAction(newGameFor(seed), { type: 'setAlwaysLiveMatches', value: false });
  const stats: SeasonStats[] = [];
  const perSeason: GameResult['perSeason'] = [];
  let current: SeasonStats = { stops: 0, liveMatches: 0, events: 0, reasons: {} };
  const rank = { D3: 1, D2: 2, D1: 3 } as const;
  let best = s.league.myDivision;

  for (let guard = 0; guard < 2000; guard++) {
    if (s.phase === 'gameOver') break;
    if (s.phase === 'offseason') {
      stats.push(current);
      perSeason.push({
        level: startingElevenLevel(s),
        treasury: s.club.treasury,
        division: s.offseason!.summary.division,
        champion: s.offseason!.summary.rank === 1,
      });
      current = { stops: 0, liveMatches: 0, events: 0, reasons: {} };
      if (stats.length >= seasons) break;
      s = playOffseason(s, strategy);
      if (rank[s.league.myDivision] > rank[best]) best = s.league.myDivision;
      continue;
    }
    s = run(s, { type: 'advance' });
    current.stops++;
    const reason = s.alerts[0]?.key ?? 'none';
    current.reasons[reason] = (current.reasons[reason] ?? 0) + 1;
    if (s.events.pending) {
      current.events++;
      s = run(s, { type: 'resolveEvent', choiceId: strategy.eventChoice(s) });
    }
    if (s.market.open && s.phase === 'season') s = strategy.recruit(s);
    if (s.currentMatch) {
      current.liveMatches++;
      while (!s.currentMatch!.finished) {
        const ctx = { players: s.squad.players, formation: s.squad.formation };
        s = run(s, { type: 'matchDecision', decision: defaultDecision(s.currentMatch!, ctx) });
      }
      s = run(s, { type: 'finishMatch' });
    }
    if (s.phase === 'season') s = strategy.build(s);
  }
  if (rank[s.league.myDivision] > rank[best]) best = s.league.myDivision;

  return {
    strategy: strategy.name,
    seasonsPlayed: s.phase === 'gameOver' ? s.time.season : stats.length,
    bankrupt: s.phase === 'gameOver',
    finalDivision: s.league.myDivision,
    bestDivision: best,
    titles: s.records.titles.length,
    promotions: s.records.promotions,
    treasury: s.club.treasury,
    satisfaction: s.city.residentSatisfaction,
    bestAttendance: s.records.bestAttendance,
    capacity: stadiumCapacity(s.city),
    population: s.city.population,
    seasons: stats,
    perSeason,
  };
}

function newGameFor(seed: number): GameState {
  return newGame({ seed, now: '2026-10-15T10:00:00.000Z', clubName: 'FC Simulation' });
}

