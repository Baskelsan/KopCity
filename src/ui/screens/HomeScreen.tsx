import { weeklyUpkeep } from '../../core/city';
import type { Action } from '../../core/game';
import { weeklyWages } from '../../core/players';
import type { GameState } from '../../core/state';
import { formatEuros, formatInteger } from '../formatters';
import { format, texts } from '../i18n';
import { describeLog } from '../logText';

const JOURNAL_SIZE = 6;

export function HomeScreen({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const journal = state.log.slice(-JOURNAL_SIZE).reverse();
  return (
    <div class="screen home">
      <div class="crest" aria-hidden="true">
        {texts.app.monogram}
      </div>
      <h1>{state.club.name}</h1>
      <p class="muted">{format(texts.game.seasonWeek, { season: state.time.season, week: state.time.week })}</p>
      <dl class="card summary">
        <div>
          <dt>{texts.game.treasury}</dt>
          <dd>{formatEuros(state.club.treasury)}</dd>
        </div>
        <div>
          <dt>{texts.game.wages}</dt>
          <dd>{format(texts.game.perWeek, { amount: formatEuros(weeklyWages(state.squad.players)) })}</dd>
        </div>
        <div>
          <dt>{texts.city.upkeep}</dt>
          <dd>{format(texts.game.perWeek, { amount: formatEuros(weeklyUpkeep(state.city)) })}</dd>
        </div>
        <div>
          <dt>{texts.game.population}</dt>
          <dd>{formatInteger(state.city.population)}</dd>
        </div>
      </dl>

      <section class="card journal">
        <h2>{texts.week.journal}</h2>
        {journal.length === 0 ? (
          <p class="muted">{texts.week.emptyJournal}</p>
        ) : (
          <ul class="plain">
            {journal.map((entry, i) => (
              <li key={i}>
                <span class="muted">{format(texts.game.seasonWeek, { season: entry.season, week: entry.week })}</span>
                <span>{describeLog(entry)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        class="button wide next-week"
        disabled={state.currentMatch !== null}
        onClick={() => dispatch({ type: 'advanceWeek' })}
      >
        {texts.week.next}
      </button>
      {state.currentMatch !== null && <p class="muted">{texts.week.matchInProgress}</p>}
    </div>
  );
}
