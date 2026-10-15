import type { MatchEvent, MatchState } from '../core/matchTypes';
import type { Player } from '../core/state';
import { format, texts } from './i18n';

const E = texts.match.events;

export function scoreLine(match: MatchState): string {
  return `${match.home.name} ${match.score.home} - ${match.score.away} ${match.away.name}`;
}

/** Texte d'une ligne du fil du match. */
export function describeEvent(event: MatchEvent, match: MatchState, players: Map<string, Player>): string {
  const name = (id: string | null) => (id ? (players.get(id)?.name ?? '') : '');
  switch (event.type) {
    case 'chance': {
      const team = match[event.side].name;
      const player = name(event.playerId);
      const vars = { team, player };
      if (event.outcome === 'goal') {
        const assist = name(event.assistId);
        if (player && assist) return format(E.goalPlayerAssist, { ...vars, assist });
        return format(player ? E.goalPlayer : E.goalTeam, vars);
      }
      if (event.outcome === 'saved') return format(player ? E.savedPlayer : E.savedTeam, vars);
      return format(player ? E.offPlayer : E.offTeam, vars);
    }
    case 'card': {
      const player = name(event.playerId);
      return format(player ? E.cardPlayer : E.cardTeam, { player, team: match[event.side].name });
    }
    case 'injury': {
      const player = name(event.playerId);
      return format(player ? E.injuryPlayer : E.injuryTeam, {
        player,
        team: match[event.side].name,
        weeks: event.weeks,
      });
    }
    case 'substitution':
      return format(E.substitution, { in: name(event.inId), out: name(event.outId) });
    case 'styleChange':
      return format(E.styleChange, { style: texts.styles[event.style].toLowerCase() });
    case 'lateChoice':
      return event.choice === 'force' ? E.lateForce : E.lateManage;
    case 'halftime':
      return format(E.halftime, { score: `${match.score.home} - ${match.score.away}` });
    case 'fulltime':
      return format(E.fulltime, { score: scoreLine(match) });
  }
}

/** Score à une minute donnée, pour l'affichage progressif du direct. */
export function scoreAt(match: MatchState, minute: number): { home: number; away: number } {
  const score = { home: 0, away: 0 };
  for (const event of match.events) {
    if (event.minute > minute) break;
    if (event.type === 'chance' && event.outcome === 'goal') score[event.side] += 1;
  }
  return score;
}
