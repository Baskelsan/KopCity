import formations from '../data/formations.json';
import { lineRating } from './players';
import type { Formation, Player, Position } from './state';

/** Ligne de chaque place de la composition : [GAR, DEF…, MIL…, ATT…]. */
export function formationSlots(formation: Formation): Position[] {
  const lines = formations[formation];
  return [
    'GAR',
    ...Array<Position>(lines.DEF).fill('DEF'),
    ...Array<Position>(lines.MIL).fill('MIL'),
    ...Array<Position>(lines.ATT).fill('ATT'),
  ];
}

export const FORMATIONS = Object.keys(formations) as Formation[];

const isAvailable = (p: Player) => p.injuryWeeks <= 0;

/**
 * Meilleur onze disponible pour la formation : d'abord les joueurs à leur poste,
 * puis on complète les places vides avec les meilleurs restants (pénalisés hors poste).
 * Une place reste vide ('') s'il n'y a plus personne.
 */
export function autoLineup(players: readonly Player[], formation: Formation): string[] {
  const slots = formationSlots(formation);
  const lineup: string[] = slots.map(() => '');
  const used = new Set<string>();
  const available = players.filter(isAvailable);

  for (const line of ['GAR', 'DEF', 'MIL', 'ATT'] as const) {
    const naturals = available
      .filter((p) => p.pos === line)
      .sort((a, b) => lineRating(b, line) - lineRating(a, line));
    slots.forEach((slot, index) => {
      if (slot !== line) return;
      const next = naturals.find((p) => !used.has(p.id));
      if (next) {
        lineup[index] = next.id;
        used.add(next.id);
      }
    });
  }

  slots.forEach((line, index) => {
    if (lineup[index]) return;
    const best = available
      .filter((p) => !used.has(p.id))
      .sort((a, b) => lineRating(b, line) - lineRating(a, line))[0];
    if (best) {
      lineup[index] = best.id;
      used.add(best.id);
    }
  });

  return lineup;
}

/**
 * Composition réellement alignée : la composition choisie, où chaque joueur absent ou blessé
 * est remplacé par le meilleur remplaçant disponible pour sa ligne.
 */
export function effectiveLineup(players: readonly Player[], formation: Formation, lineup: readonly string[]): string[] {
  const slots = formationSlots(formation);
  const byId = new Map(players.map((p) => [p.id, p]));
  const used = new Set<string>();
  const result = slots.map((_, index) => {
    const id = lineup[index];
    const player = id ? byId.get(id) : undefined;
    if (player && isAvailable(player) && !used.has(player.id)) {
      used.add(player.id);
      return player.id;
    }
    return '';
  });

  slots.forEach((line, index) => {
    if (result[index]) return;
    const best = players
      .filter((p) => isAvailable(p) && !used.has(p.id))
      .sort((a, b) => lineRating(b, line) - lineRating(a, line))[0];
    if (best) {
      result[index] = best.id;
      used.add(best.id);
    }
  });
  return result;
}

/** Remplaçants : tous les joueurs disponibles qui ne sont pas titulaires. */
export function benchOf(players: readonly Player[], lineup: readonly string[]): string[] {
  const starters = new Set(lineup);
  return players.filter((p) => isAvailable(p) && !starters.has(p.id)).map((p) => p.id);
}

/** Échange deux joueurs : deux titulaires changent de place, ou un remplaçant prend la place d'un titulaire. */
export function swapInLineup(lineup: readonly string[], a: string, b: string): string[] {
  const ia = lineup.indexOf(a);
  const ib = lineup.indexOf(b);
  const next = [...lineup];
  if (ia >= 0 && ib >= 0) {
    next[ia] = b;
    next[ib] = a;
  } else if (ia >= 0) {
    next[ia] = b;
  } else if (ib >= 0) {
    next[ib] = a;
  }
  return next;
}
