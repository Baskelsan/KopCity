import balance from '../data/balance.json';
import { attendanceFor, matchAttraction, ticketPrice } from '../core/economy';
import type { Action } from '../core/game';
import { myDivision, opponentOf } from '../core/league';
import { MY_TEAM_ID, type GameState } from '../core/state';
import { formatEuros, formatInteger } from './formatters';
import { format, texts } from './i18n';

const T = texts.ticketing;

/** Réglage du prix du billet, avec l'affluence et la recette prévues au prochain match à domicile. */
export function TicketPriceCard({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const factor = state.club.ticketPriceFactor;
  const base = balance.economy.ticketPrice[state.league.myDivision];
  const next = myDivision(state.league)
    .fixtures.filter((f) => f.home === MY_TEAM_ID && !f.result && f.week >= state.time.week)
    .sort((a, b) => a.week - b.week)[0];
  const attraction =
    state.phase === 'season' && next ? matchAttraction(state, opponentOf(next)) : balance.attraction.base;
  const attendance = attendanceFor(state.city, attraction, factor).attendance;
  const step = balance.ticketing.step;

  return (
    <section class="card ticketing">
      <h2>{T.title}</h2>
      <div class="price-stepper">
        <button
          type="button"
          class="button secondary"
          disabled={factor <= balance.ticketing.minFactor}
          onClick={() => dispatch({ type: 'setTicketPrice', factor: factor - step })}
          aria-label={T.cheaper}
        >
          −
        </button>
        <div class="price-value">
          <strong>{formatEuros(ticketPrice(state))}</strong>
          <small class="muted">{format(T.base, { base: formatEuros(base), percent: Math.round(factor * 100) })}</small>
        </div>
        <button
          type="button"
          class="button secondary"
          disabled={factor >= balance.ticketing.maxFactor}
          onClick={() => dispatch({ type: 'setTicketPrice', factor: factor + step })}
          aria-label={T.dearer}
        >
          +
        </button>
      </div>
      <p>
        {format(T.forecast, {
          attendance: formatInteger(attendance),
          revenue: formatEuros(attendance * ticketPrice(state)),
        })}
      </p>
      {factor > balance.ticketing.angryAbove && <p class="refusal">{T.angry}</p>}
    </section>
  );
}
