import balance from '../data/balance.json';
import names from '../data/names.json';
import { nextFloat, nextInt, pick, type Draw } from './rng';
import type { DivisionId, Player, PlayerStats, Position } from './state';

const P = balance.players;
const S = balance.strength;

export const POSITIONS: readonly Position[] = ['GAR', 'DEF', 'MIL', 'ATT'];
const STAT_KEYS: readonly (keyof PlayerStats)[] = ['att', 'def', 'pas', 'phy'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Valeur d'un joueur dans une ligne : moyenne pondérée de ses stats, pénalisée hors de son poste. */
export function lineRating(player: Player, line: Position): number {
  const weights = S.lineWeights[line];
  const raw = STAT_KEYS.reduce((sum, key) => sum + player.stats[key] * weights[key], 0);
  if (player.pos === line) return raw;
  return raw * (line === 'GAR' ? S.outOfPositionGoalkeeperFactor : S.outOfPositionFactor);
}

/** Note globale affichée (sur 20) : valeur du joueur à son poste. */
export function overall(player: Player): number {
  return Math.round(lineRating(player, player.pos));
}

/** Étoiles affichées : potentiel ÷ 4 plus l'erreur d'estimation, à la demi-étoile, entre 0,5 et 5. */
export function starsShown(potential: number, error: number): number {
  const stars = Math.round((potential / P.starsDivisor + error) * 2) / 2;
  return clamp(stars, 0.5, 5);
}

export function monthlySalary(rating: number): number {
  const { monthlyAtReference, referenceRating, exponent, rounding } = P.salary;
  const raw = monthlyAtReference * Math.pow(rating / referenceRating, exponent);
  return Math.max(rounding, Math.round(raw / rounding) * rounding);
}

function potentialGap(age: number): number {
  return P.potentialGapByAge.find((step) => age <= step.maxAge)?.gap ?? 0;
}

export function floatBetween(rngState: number, min: number, max: number): Draw<number> {
  const draw = nextFloat(rngState);
  return { value: min + draw.value * (max - min), rngState: draw.rngState };
}

/** Identifiant tiré du générateur : « p » suivi de 8 caractères hexadécimaux. */
function newId(rngState: number, prefix: string): Draw<string> {
  const draw = nextInt(rngState, 0, 0xffffffff);
  return { value: prefix + draw.value.toString(16).padStart(8, '0'), rngState: draw.rngState };
}

export interface PlayerOptions {
  ageMin?: number;
  ageMax?: number;
  /** Potentiel visé (au moins la note actuelle) ; sinon tiré selon l'âge. */
  potential?: number;
  /** Multiplie l'erreur d'estimation des étoiles (le centre de formation la réduit). */
  starsErrorFactor?: number;
  homegrown?: boolean;
  contractYears?: number;
}

export function generatePlayer(rngState: number, pos: Position, level: number, options: PlayerOptions = {}): Draw<Player> {
  let rng = rngState;
  const take = <T>(draw: Draw<T>): T => {
    rng = draw.rngState;
    return draw.value;
  };

  const id = take(newId(rng, 'p'));
  const firstName = take(pick(rng, names.firstNames));
  const lastName = take(pick(rng, names.lastNames));
  const age = take(nextInt(rng, options.ageMin ?? P.ageMin, options.ageMax ?? P.ageMax));
  const base = level + take(floatBetween(rng, -P.levelSpread, P.levelSpread));
  const profile = P.positionProfile[pos];
  const stats = {} as PlayerStats;
  for (const key of STAT_KEYS) {
    const noise = take(floatBetween(rng, -P.statNoise, P.statNoise));
    stats[key] = clamp(Math.round(base + profile[key] + noise), 1, 20);
  }

  const player: Player = {
    id,
    name: `${firstName.charAt(0)}. ${lastName}`,
    pos,
    age,
    stats,
    potential: 0,
    potentialStarsShown: 0,
    morale: P.startMorale,
    monthlySalary: 0,
    contractYears: take(nextInt(rng, P.contractYearsMin, P.contractYearsMax)),
    injuryWeeks: 0,
    homegrown: options.homegrown ?? false,
    seasonStats: { apps: 0, goals: 0, assists: 0, ratingTotal: 0 },
    careerStats: { apps: 0, goals: 0, assists: 0, ratingTotal: 0 },
  };
  if (options.contractYears !== undefined) player.contractYears = options.contractYears;
  const rating = overall(player);
  const gap = take(nextInt(rng, 0, potentialGap(age)));
  const target = options.potential !== undefined ? Math.round(options.potential) : rating + gap;
  player.potential = clamp(Math.max(rating, target), 1, 20);
  const errorRange = P.starsError * (options.starsErrorFactor ?? 1);
  player.potentialStarsShown = starsShown(player.potential, take(floatBetween(rng, -errorRange, errorRange)));
  player.monthlySalary = monthlySalary(lineRating(player, pos));
  return { value: player, rngState: rng };
}

export function divisionLevel(division: DivisionId): number {
  return P.divisionLevel[division];
}

/** Effectif complet (18 joueurs) au niveau donné. */
export function generateSquad(rngState: number, level: number): Draw<Player[]> {
  let rng = rngState;
  const players: Player[] = [];
  for (const pos of POSITIONS) {
    for (let i = 0; i < P.squadComposition[pos]; i++) {
      const draw = generatePlayer(rng, pos, level);
      rng = draw.rngState;
      players.push(draw.value);
    }
  }
  return { value: players, rngState: rng };
}

/** Masse salariale ramenée à la semaine (× 12 ÷ 52). */
export function weeklyWages(players: readonly Player[]): number {
  return (players.reduce((sum, p) => sum + p.monthlySalary, 0) * 12) / 52;
}

/** Salaire d'un nouveau contrat : plus cher dans les divisions supérieures (×1, ×1,3, ×1,7). */
export function contractSalary(player: Player, division: DivisionId): number {
  const { rounding } = P.salary;
  const raw = monthlySalary(lineRating(player, player.pos)) * balance.salaryDivisionFactor[division];
  return Math.max(rounding, Math.round(raw / rounding) * rounding);
}

/** Valeur de transfert : selon la note au poste et l'âge (un jeune vaut plus qu'un vétéran). */
export function transferValue(player: Player): number {
  const M = balance.market;
  const ageFactor = M.ageFactors.find((a) => player.age <= a.maxAge)?.factor ?? 1;
  const raw = M.valueAtReference * Math.pow(lineRating(player, player.pos) / M.referenceRating, M.valueExponent) * ageFactor;
  return Math.max(M.valueRounding, Math.round(raw / M.valueRounding) * M.valueRounding);
}

/** Ce que rapporte la vente d'un joueur (80 % de sa valeur). */
export function saleValue(player: Player): number {
  return Math.round(transferValue(player) * balance.market.sellFactor);
}

/** Poste tiré selon des poids (ex. plus de défenseurs et de milieux que de gardiens). */
export function weightedPosition(rngState: number, weights: Record<Position, number>): Draw<Position> {
  const total = POSITIONS.reduce((sum, p) => sum + weights[p], 0);
  const draw = nextFloat(rngState);
  let target = draw.value * total;
  for (const pos of POSITIONS) {
    target -= weights[pos];
    if (target < 0) return { value: pos, rngState: draw.rngState };
  }
  return { value: 'MIL', rngState: draw.rngState };
}
