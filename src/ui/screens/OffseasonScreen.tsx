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
import { exportReminderDue } from '../../core/exportReminder';
import { exportSaveFile } from '../../storage/files';
import { topScorer } from '../../core/records';
import { formatInteger } from '../formatters';

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

export function OffseasonScreen({
  state,
  dispatch,
  notify,
}: {
  state: GameState;
  dispatch: (action: Action) => void;
  notify: (message: string) => void;
}) {
  const handleExport = async () => {
    try {
      await exportSaveFile(state, new Date().toISOString());
      dispatch({ type: 'markExported' });
      notify(texts.save.exported);
    } catch {
      notify(texts.save.exportFailed);
    }
  };
  const [showMarket, setShowMarket] = useState(false);
  const offseason = state.offseason!;
  const { summary } = offseason;
  const expiring = expiringPlayers(state);
  const size = squadSizeAtStart(state);
  const start = canStartSeason(state);
  const addCheck = canAddPlayer(state);
  const { min, max } = balance.squadSize;
  const changes = offseason.ratingChanges
    .filter((c) => c.after !== c.before)
    .sort((a, b) => b.after - b.before - (a.after - a.before));

  return (
    <div class="screen home-screen">
      <h1>{O.title}</h1>

      {exportReminderDue(state) && (
        <section class="card export-reminder">
          <p>{texts.exportReminder.text}</p>
          <button type="button" class="button" onClick={() => void handleExport()}>
            {texts.exportReminder.button}
          </button>
        </section>
      )}

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
        <h2>{texts.objectives.resultsTitle}</h2>
        <ul class="plain objectives">
          {offseason.objectiveResults.map((r) => (
            <li key={r.id} class={r.achieved ? 'done' : ''}>
              <span>
                {r.achieved ? '✓ ' : '✗ '}
                {texts.objectives.items[r.id as keyof typeof texts.objectives.items]}
              </span>
              <small class={r.achieved ? 'positive' : 'muted'}>
                {r.achieved ? format(texts.objectives.achieved, { reward: formatEuros(r.reward) }) : texts.objectives.missed}
              </small>
            </li>
          ))}
        </ul>
        {offseason.objectiveResults.length > 0 && offseason.objectiveResults.every((r) => r.achieved) && (
          <p class="positive">{texts.objectives.allAchieved}</p>
        )}
        {offseason.recordsBeaten.length > 0 && (
          <>
            <h3>{texts.records.beatenTitle}</h3>
            <ul class="plain">
              {offseason.recordsBeaten.map((key) => {
                const best = topScorer(state.records);
                const value =
                  key === 'bestAttendance' ? formatInteger(state.records.bestAttendance) : formatEuros(state.records.bestTreasury);
                return (
                  <li key={key}>
                    {format(texts.records.beaten[key], { value, name: best?.name ?? '', goals: best?.goals ?? 0 })}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section class="card">
        <h2>{O.ratingsTitle}</h2>
        {changes.length === 0 ? (
          <p class="muted">{O.ratingsNone}</p>
        ) : (
          <ul class="plain rating-changes">
            {changes.map((c) => {
              const delta = c.after - c.before;
              return (
                <li key={c.playerId}>
                  <span>
                    {c.name} <small class="muted">· {format(O.ratingsAge, { age: c.age })}</small>
                  </span>
                  <span class={delta > 0 ? 'positive' : 'negative'}>
                    {format(O.ratingChange, { before: c.before, after: c.after })} ({delta > 0 ? `+${delta}` : delta})
                  </span>
                </li>
              );
            })}
          </ul>
        )}
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
