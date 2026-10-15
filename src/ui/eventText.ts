import type { EventEffect } from '../core/events';
import type { GameState, PendingEvent } from '../core/state';
import { formatEuros, formatStars } from './formatters';
import { format, texts } from './i18n';

const EF = texts.effects;

type EventId = keyof typeof texts.events;

export function eventTexts(eventId: string) {
  return texts.events[eventId as EventId];
}

function signedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function signedEuros(value: number): string {
  return value > 0 ? `+${formatEuros(value)}` : formatEuros(value);
}

const percent = (factor: number) => `${factor >= 1 ? '+' : '−'}${Math.round(Math.abs(1 - factor) * 100)} %`;

/** Paramètres d'affichage d'un événement : joueur visé, prix, jeune prodige. */
export function eventParams(state: GameState, pending: PendingEvent): Record<string, string | number> {
  const player = state.squad.players.find((p) => p.id === pending.targetPlayerId);
  const prodigy = pending.prodigy;
  return {
    player: player?.name ?? '',
    price: formatEuros(pending.offerPrice),
    prodigy: prodigy?.name ?? '',
    age: prodigy?.age ?? 0,
    stars: prodigy ? formatStars(prodigy.potentialStarsShown) : '',
  };
}

/** Texte d'un effet, chiffré, affiché avant de choisir. */
export function describeEffect(effect: EventEffect, params: Record<string, string | number>): string {
  switch (effect.type) {
    case 'treasury':
      return format(EF.treasury, { amount: signedEuros(effect.amount) });
    case 'satisfaction':
      return format(EF.satisfaction, { amount: signedNumber(effect.amount) });
    case 'moraleAll':
      return format(EF.moraleAll, { amount: signedNumber(effect.amount) });
    case 'moraleTarget':
      return format(EF.moraleTarget, { ...params, amount: signedNumber(effect.amount) });
    case 'supporters':
      return format(EF.supporters, { amount: signedNumber(effect.points) });
    case 'injureTarget':
      return effect.weeksMin === effect.weeksMax
        ? format(EF.injureExact, { ...params, weeks: effect.weeksMin })
        : format(EF.injureRange, { ...params, min: effect.weeksMin, max: effect.weeksMax });
    case 'injureRandom':
      return format(EF.injureRandom, { min: effect.weeksMin, max: effect.weeksMax });
    case 'sellTarget':
      return format(EF.sellTarget, params);
    case 'signProdigy':
      return format(EF.signProdigy, params);
    case 'homeStrength':
      return format(EF.homeStrength, { percent: percent(effect.factor), matches: effect.matches });
    case 'attendance':
      return format(EF.attendance, { percent: percent(effect.factor) });
    case 'sponsorBonus':
      return format(EF.sponsorBonus, {
        amount: formatEuros(effect.perWeek),
        weeks: effect.weeks,
        total: formatEuros(effect.perWeek * effect.weeks),
      });
    case 'commitTransport':
      return format(EF.commitTransport, { amount: formatEuros(effect.repay), satisfaction: signedNumber(effect.satisfaction) });
    case 'risk':
      return format(EF.risk, {
        percent: `${Math.round(effect.chance * 100)} %`,
        inner: effect.effects.map((e) => describeEffect(e, params)).join(', '),
      });
  }
}
