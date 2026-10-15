// v1 → v2 (M2) : génération de l'effectif, gardien dans la force des équipes, match en cours.
import { startingSquad } from '../../core/game';
import type { DivisionId, Formation, PlayStyle } from '../../core/state';
import type { Migration } from './index';

type Obj = Record<string, unknown>;

export const v1ToV2: Migration = (save) => {
  const meta = save.meta as Obj;
  const squad = save.squad as Obj;
  const league = save.league as Obj;

  let rngState = meta.rngState as number;
  let nextSquad = squad;
  const players = squad.players as unknown[];
  if (players.length === 0) {
    const generated = startingSquad(
      rngState,
      league.myDivision as DivisionId,
      squad.formation as Formation,
      squad.style as PlayStyle,
    );
    rngState = generated.rngState;
    nextSquad = { ...generated.squad };
  }

  // Les équipes v1 n'avaient pas de gardien : on lui donne le niveau moyen d'un joueur de champ.
  const divisions = (league.divisions as Obj[]).map((division) => ({
    ...division,
    teams: (division.teams as Obj[]).map((team) => {
      const strength = team.strength as { att: number; mid: number; def: number };
      return { ...team, strength: { ...strength, gk: strength.mid / 4 } };
    }),
  }));

  return {
    ...save,
    meta: { ...meta, rngState },
    squad: nextSquad,
    league: { ...league, divisions },
    currentMatch: null,
  };
};
