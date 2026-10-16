import type { GameState } from '../core/state';
import { format, texts } from './i18n';
import { teamName } from './logText';

const C = texts.cup;

export function cupRoundName(round: number): string {
  return C.rounds[round - 1] ?? '';
}

/** « Coupe, Quarts de finale : Victoire 2-1 contre AS Valmont. Qualifié pour le tour suivant ! » */
export function describeCupResult(params: Record<string, string | number>, state: GameState): string {
  const scored = Number(params.scored);
  const conceded = Number(params.conceded);
  const won = Number(params.won) === 1;
  const penaltiesFor = Number(params.penaltiesFor);
  const outcome = scored > conceded ? 'win' : scored < conceded ? 'loss' : 'draw';
  const round = Number(params.round);
  const verdict = !won ? C.eliminated : round === C.rounds.length ? C.winner : C.qualified;
  const line = format(C.result, {
    round: cupRoundName(round),
    outcome: texts.outcomes[outcome],
    scored,
    conceded,
    penalties: penaltiesFor >= 0 ? format(C.penalties, { for: penaltiesFor, against: Number(params.penaltiesAgainst) }) : '',
    opponent: teamName(state, String(params.opponent)),
  });
  return `${line} ${verdict}`;
}
