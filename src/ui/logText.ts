import { divisionAbove, divisionBelow } from '../core/league';
import type { Alert, BuildingType, DistrictId, DivisionId, GameState, LogEntry, Movement } from '../core/state';
import type { KeyMatchReason } from '../core/season';
import { eventTexts } from './eventText';
import { formatEuros } from './formatters';
import { format, texts } from './i18n';

const buildingName = (type: unknown) => texts.buildings[type as BuildingType | 'stadium'] ?? '';
const districtName = (id: unknown) => texts.city.districts[id as DistrictId] ?? '';

/** « 1er », « 2e »… */
export function rankText(rank: number): string {
  return rank === 1 ? `${rank}er` : `${rank}e`;
}

/** « Montée en Division 2 ! », « Maintien en Division 3. »… à partir de la division quittée. */
export function movementText(movement: Movement, from: DivisionId): string {
  const to = movement === 'promoted' ? divisionAbove(from) : movement === 'relegated' ? divisionBelow(from) : from;
  return format(texts.movements[movement], { division: texts.divisions[to ?? from] });
}

export function teamName(state: GameState, teamId: string): string {
  if (teamId === 'me') return state.club.name;
  for (const division of state.league.divisions) {
    const team = division.teams.find((t) => t.id === teamId);
    if (team) return team.name;
  }
  return teamId;
}

/** Texte d'une entrée du journal (la clé et les paramètres viennent du cœur). */
export function describeLog(entry: LogEntry, state: GameState): string {
  const params = entry.params ?? {};
  switch (entry.key) {
    case 'constructionDelivered':
      return format(texts.log.constructionDelivered, { building: buildingName(params.type), level: params.level ?? 1 });
    case 'districtUnlocked':
      return format(texts.log.districtUnlocked, { district: districtName(params.district) });
    case 'seasonEnd':
      return format(texts.log.seasonEnd, {
        rank: rankText(Number(params.rank)),
        division: texts.divisions[params.division as DivisionId],
        movement: movementText(params.movement as Movement, params.division as DivisionId),
      });
    case 'eventResolved': {
      const t = eventTexts(String(params.eventId));
      return format(texts.log.eventResolved, { title: t.title, choice: t.choices[params.choiceId as keyof typeof t.choices] });
    }
    case 'matchResult': {
      const scored = Number(params.scored);
      const conceded = Number(params.conceded);
      const outcome = scored > conceded ? 'win' : scored < conceded ? 'loss' : 'draw';
      return format(texts.log.matchResult, {
        outcome: texts.outcomes[outcome],
        scored,
        conceded,
        opponent: teamName(state, String(params.opponent)),
        venue: params.home ? texts.venueShort.home : texts.venueShort.away,
      });
    }
    default:
      return entry.key;
  }
}

/** Texte d'une raison d'arrêt. */
export function describeAlert(alert: Alert, state: GameState): string {
  const params = alert.params ?? {};
  const A = texts.alerts;
  switch (alert.key) {
    case 'keyMatch': {
      const reasons = String(params.reasons ?? '')
        .split(',')
        .filter(Boolean)
        .map((r) => A.reasons[r as KeyMatchReason]);
      return format(A.keyMatch, { reasons: reasons.join(', ') });
    }
    case 'constructionDelivered':
      return format(A.constructionDelivered, { building: buildingName(params.type) });
    case 'districtUnlocked':
      return format(A.districtUnlocked, { district: districtName(params.district) });
    case 'starterInjured': {
      const player = state.squad.players.find((p) => p.id === params.playerId);
      return format(A.starterInjured, { player: player?.name ?? '', weeks: params.weeks ?? 0 });
    }
    case 'treasuryNegative':
      return format(A.treasuryNegative, { treasury: formatEuros(Number(params.treasury)), weeks: params.weeks ?? 1 });
    case 'lowSatisfaction':
      return format(A.lowSatisfaction, { satisfaction: params.satisfaction ?? 0 });
    case 'seasonOver':
      return A.seasonOver;
    case 'winterMarket':
      return A.winterMarket;
    case 'event':
      return format(A.event, { title: eventTexts(String(params.eventId)).title });
    case 'bankruptcy':
      return A.bankruptcy;
    case 'eventOutcome': {
      const t = eventTexts(String(params.eventId));
      const details: string[] = [];
      if (params.riskHit !== undefined) details.push(params.riskHit ? texts.eventUi.riskHit : texts.eventUi.riskAvoided);
      if (params.playerId) {
        const player = state.squad.players.find((p) => p.id === params.playerId);
        details.push(format(texts.eventUi.injured, { player: player?.name ?? '', weeks: params.weeks ?? 0 }));
      }
      return format(A.eventOutcome, {
        title: t.title,
        choice: t.choices[params.choiceId as keyof typeof t.choices],
        detail: details.join(' '),
      }).trim();
    }
  }
}
