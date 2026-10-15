import balance from '../data/balance.json';
import names from '../data/names.json';
import { autoLineup, formationSlots } from './lineup';
import { generateSquad, lineRating } from './players';
import { nextFloat, pick, type Draw } from './rng';
import type { Formation, Player, PlayStyle, Team, TeamStrength } from './state';
import type { LateChoice } from './matchTypes';

const S = balance.strength;

export interface StrengthModifiers {
  style: PlayStyle;
  late: LateChoice;
  /** Moral moyen des joueurs alignés (0 à 100) ; 50 = neutre. */
  morale: number;
  home: boolean;
}

/** Forces brutes d'une composition, sans style ni moral ni terrain. Une place vide ('') ne compte pas. */
export function lineupStrength(players: readonly Player[], formation: Formation, lineup: readonly string[]): TeamStrength {
  const byId = new Map(players.map((p) => [p.id, p]));
  const sums = { GAR: 0, DEF: 0, MIL: 0, ATT: 0 };
  formationSlots(formation).forEach((line, index) => {
    const player = byId.get(lineup[index] ?? '');
    if (player) sums[line] += lineRating(player, line);
  });
  return {
    att: sums.ATT + S.midfieldSupport * sums.MIL,
    mid: sums.MIL,
    def: sums.DEF + S.midfieldSupport * sums.MIL,
    gk: sums.GAR,
  };
}

/** Applique le style, le choix de fin de match, le moral et l'avantage du terrain. */
export function applyModifiers(base: TeamStrength, mods: StrengthModifiers): TeamStrength {
  const shift = S.styleShift[mods.style] + S.lateShift[mods.late];
  const morale = 1 + S.moraleEffect * ((mods.morale - 50) / 50);
  const home = mods.home ? 1 + S.homeAdvantage : 1;
  const factor = morale * home;
  return {
    att: base.att * (1 + shift) * factor,
    mid: base.mid * factor,
    def: base.def * (1 - shift) * factor,
    gk: base.gk * factor,
  };
}

export function averageMorale(players: readonly Player[], lineup: readonly string[]): number {
  const byId = new Map(players.map((p) => [p.id, p]));
  const fielded = lineup.map((id) => byId.get(id)).filter((p): p is Player => p !== undefined);
  if (fielded.length === 0) return 50;
  return fielded.reduce((sum, p) => sum + p.morale, 0) / fielded.length;
}

/**
 * Adversaire généré : un effectif virtuel au niveau donné (± un écart), aligné en 4-4-2.
 * Seule sa force est gardée, sur la même échelle que celle du club.
 */
export function generateOpponent(rngState: number, level: number, id: string): Draw<Team> {
  let rng = rngState;
  const prefix = pick(rng, names.clubPrefixes);
  rng = prefix.rngState;
  const town = pick(rng, names.towns);
  rng = town.rngState;
  const spread = nextFloat(rng);
  rng = spread.rngState;
  const teamLevel = level + (spread.value * 2 - 1) * S.opponentLevelSpread;
  const squad = generateSquad(rng, teamLevel);
  rng = squad.rngState;
  const formation: Formation = '4-4-2';
  const strength = lineupStrength(squad.value, formation, autoLineup(squad.value, formation));
  return { value: { id, name: `${prefix.value} ${town.value}`, strength }, rngState: rng };
}
