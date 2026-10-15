import { useState } from 'preact/hooks';
import balance from '../../data/balance.json';
import type { Action } from '../../core/game';
import { canAddPlayer, canStartSeason, expiringPlayers, renewalSalary, squadSizeAtStart } from '../../core/offseason';
import { overall } from '../../core/players';
import type { GameState, Player } from '../../core/state';
import { formatEuros, formatStars } from '../formatters';
import { format, texts } from '../i18n';
import { movementText, rankText } from '../logText';
import { MarketSheet, refusalText } from '../MarketSheet';

const O = texts.offseason;
const YEARS = Array.from(
  { length: balance.contracts.yearsMax - balance.contracts.yearsMin + 1 },
  (_, i) => balance.contracts.yearsMin + i,
);

function signed(value: number): string {
  return value > 0 ? `+${formatEuros(value)}` : formatEuros(value);
}

function PlayerLine({ player }: { player: Player }) {
  return (
    <div class="offer-head">
      <span class={`pos pos-${player.pos}`}>{texts.positions[player.pos]}</span>
      <strong>{player.name}</strong>
      <span class="rating">{overall(player)}</span>
    </div>
  );
}

export function OffseasonScreen({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const [showMarket, setShowMarket] = useState(false);
  const offseason = state.offseason!;
  const { summary } = offseason;
  const expiring = expiringPlayers(state);
  const size = squadSizeAtStart(state);
  const start = canStartSeason(state);
  const addCheck = canAddPlayer(state);
  const { min, max } = balance.squadSize;

  return (
    <div class="screen home-screen">
      <h1>{O.title}</h1>

      <section class="card">
        <h2>{format(O.summaryTitle, { season: summary.season })}</h2>
        <p>
          <strong>{format(O.rank, { rank: rankText(summary.rank), division: texts.divisions[summary.division] })}</strong>
        </p>
        <p class={summary.movement === 'promoted' ? 'positive' : summary.movement === 'relegated' ? 'negative' : ''}>
          {movementText(summary.movement, summary.division)}
        </p>
        <p>{format(O.bonus, { bonus: formatEuros(summary.bonus) })}</p>
        <p class="muted">{format(O.net, { net: signed(summary.net) })}</p>
        {offseason.retired.length > 0 && <p class="muted">{format(O.retired, { names: offseason.retired.join(', ') })}</p>}
      </section>

      <section class="card">
        <h2>{O.contractsTitle}</h2>
        {expiring.length === 0 ? (
          <p class="muted">{O.contractsNone}</p>
        ) : (
          <>
            <p class="muted">{O.contractsHint}</p>
            <ul class="plain offers">
              {expiring.map((p) => (
                <li key={p.id} class="offer">
                  <PlayerLine player={p} />
                  <p class="muted">
                    {format(texts.squad.age, { age: p.age })} ·{' '}
                    {format(O.newSalary, { salary: formatEuros(renewalSalary(p)) })}
                  </p>
                  <div class="segmented">
                    {YEARS.map((years) => (
                      <button
                        key={years}
                        type="button"
                        onClick={() => dispatch({ type: 'renewContract', playerId: p.id, years })}
                      >
                        {format(O.renew, { years })}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section class="card">
        <h2>{O.prospectsTitle}</h2>
        {offseason.prospects.length === 0 ? (
          <p class="muted">{O.prospectsNone}</p>
        ) : (
          <ul class="plain offers">
            {offseason.prospects.map((p) => (
              <li key={p.id} class="offer">
                <PlayerLine player={p} />
                <p class="muted">
                  {format(texts.squad.age, { age: p.age })} · {formatStars(p.potentialStarsShown)}
                </p>
                <div class="actions">
                  <button
                    type="button"
                    class="button"
                    disabled={!addCheck.ok}
                    onClick={() => dispatch({ type: 'signProspect', playerId: p.id })}
                  >
                    {O.sign}
                  </button>
                  <button
                    type="button"
                    class="button secondary"
                    onClick={() => dispatch({ type: 'declineProspect', playerId: p.id })}
                  >
                    {O.decline}
                  </button>
                </div>
                {!addCheck.ok && <p class="refusal">{refusalText(addCheck)}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="card">
        <h2>{O.marketTitle}</h2>
        <button type="button" class="button secondary wide" onClick={() => setShowMarket(true)}>
          {format(O.openMarket, { count: state.market.offers.length })}
        </button>
      </section>

      <p class={start.ok ? 'muted' : 'refusal'}>
        {format(O.squadSize, { count: size, min, max })}
        {!start.ok && ` — ${format(start.reason === 'squadTooSmall' ? O.squadTooSmall : O.squadFull, { min, max })}`}
      </p>

      <div class="advance-bar">
        <button
          type="button"
          class="button wide big"
          disabled={!start.ok}
          onClick={() => dispatch({ type: 'startSeason' })}
        >
          {format(O.start, { season: state.time.season + 1 })}
        </button>
      </div>

      {showMarket && <MarketSheet state={state} dispatch={dispatch} onClose={() => setShowMarket(false)} />}
    </div>
  );
}
