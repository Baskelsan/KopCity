import balance from '../data/balance.json';
import type { Action } from '../core/game';
import { canAddPlayer, type SquadCheck } from '../core/offseason';
import { overall } from '../core/players';
import type { GameState } from '../core/state';
import { formatEuros, formatStars } from './formatters';
import { format, texts } from './i18n';
import { Sheet } from './Sheet';

const MK = texts.market;

/** Raison lisible d'un refus (effectif plein, argent…). */
export function refusalText(check: SquadCheck): string {
  if (check.ok) return '';
  return format(MK.refusals[check.reason], { min: balance.squadSize.min, max: balance.squadSize.max });
}

export function MarketSheet({
  state,
  dispatch,
  onClose,
}: {
  state: GameState;
  dispatch: (action: Action) => void;
  onClose: () => void;
}) {
  const offers = state.market.offers;
  return (
    <Sheet title={MK.title} onClose={onClose}>
      <p class="muted">
        {texts.game.treasury} : {formatEuros(state.club.treasury)}
      </p>
      {offers.length === 0 && <p class="muted">{MK.empty}</p>}
      <ul class="plain offers">
        {offers.map(({ player, price, star }) => {
          const check = canAddPlayer(state, price);
          return (
            <li key={player.id} class={star ? 'offer star-offer' : 'offer'}>
              <div class="offer-head">
                <span class={`pos pos-${player.pos}`}>{texts.positions[player.pos]}</span>
                <strong>
                  {player.name} {star && <span class="tag star-tag">{MK.star}</span>}
                </strong>
                <span class="rating">{overall(player)}</span>
              </div>
              {star && (
                <p class="muted">
                  {format(MK.starHint, { factor: String(balance.market.stars.priceFactor).replace('.', ',') })}
                </p>
              )}
              <p class="muted">
                {format(texts.squad.age, { age: player.age })} · {formatStars(player.potentialStarsShown)} ·{' '}
                {format(MK.salary, { salary: formatEuros(player.monthlySalary) })}
              </p>
              {check.ok ? (
                <button
                  type="button"
                  class="button wide"
                  onClick={() => {
                    if (window.confirm(format(MK.confirmBuy, { player: player.name, price: formatEuros(price) }))) {
                      dispatch({ type: 'buyPlayer', playerId: player.id });
                    }
                  }}
                >
                  {format(MK.buy, { price: formatEuros(price) })}
                </button>
              ) : (
                <p class="refusal">
                  {formatEuros(price)} · {refusalText(check)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" class="button secondary wide" onClick={onClose}>
        {MK.close}
      </button>
    </Sheet>
  );
}
