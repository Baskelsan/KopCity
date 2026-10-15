import { useState } from 'preact/hooks';
import balance from '../../data/balance.json';
import { netResult } from '../../core/economy';
import type { Action } from '../../core/game';
import { myDivision, myFixture, opponentOf, rankOf } from '../../core/league';
import { seasonOver } from '../../core/season';
import { MY_TEAM_ID, type GameState } from '../../core/state';
import { EventSheet } from '../EventSheet';
import { FinanceSheet } from '../FinanceSheet';
import { ObjectivesCard } from '../ObjectivesCard';
import { formatEuros } from '../formatters';
import { format, texts } from '../i18n';
import { describeAlert, describeLog, teamName } from '../logText';

const H = texts.home;
const JOURNAL_SIZE = 6;

function signed(value: number): string {
  return value > 0 ? `+${formatEuros(value)}` : formatEuros(value);
}

interface HomeScreenProps {
  state: GameState;
  dispatch: (action: Action) => void;
  onOpenMatch: () => void;
}

export function HomeScreen({ state, dispatch, onOpenMatch }: HomeScreenProps) {
  const [showAccounts, setShowAccounts] = useState(false);
  const [showEvent, setShowEvent] = useState(true);
  const division = myDivision(state.league);
  const teams = division.table.length;
  const rank = rankOf(division.table, MY_TEAM_ID);
  const started = division.table.some((row) => row.played > 0);
  const fixture = myFixture(division, state.time.week);
  const over = seasonOver(state);
  const lastWeek = state.finance.lastWeek;
  const journal = state.log.slice(-JOURNAL_SIZE).reverse();

  return (
    <div class="screen home-screen">
      <header class="club-header">
        <div class="crest small-crest" aria-hidden="true">
          {texts.app.monogram}
        </div>
        <div>
          <h1>{state.club.name}</h1>
          <p class="muted">
            {texts.divisions[state.league.myDivision]} ·{' '}
            {format(texts.game.seasonWeek, { season: state.time.season, week: Math.min(state.time.week, balance.league.seasonWeeks) })}
            {started && ` · ${format(rank === 1 ? H.rankFirst : H.rank, { rank, teams })}`}
          </p>
        </div>
      </header>

      <button type="button" class="card money" onClick={() => setShowAccounts(true)}>
        <span class="muted">{texts.game.treasury}</span>
        <strong class={state.club.treasury < 0 ? 'negative' : ''}>{formatEuros(state.club.treasury)}</strong>
        <span class={lastWeek && netResult(lastWeek) < 0 ? 'negative' : 'positive'}>
          {lastWeek ? format(H.weekResult, { amount: signed(netResult(lastWeek)) }) : H.noWeekYet}
        </span>
        <span class="link">{H.seeAccounts}</span>
      </button>

      {state.alerts.length > 0 && (
        <section class="card alerts">
          <h2>{H.stopTitle}</h2>
          <ul class="plain">
            {state.alerts.map((alert, i) => (
              <li key={i}>{describeAlert(alert, state)}</li>
            ))}
          </ul>
        </section>
      )}

      {over ? (
        <section class="card">
          <h2>{H.seasonOverTitle}</h2>
          <p>
            {format(H.seasonOverText, {
              rank: format(rank === 1 ? H.rankFirst : H.rank, { rank, teams }),
              net: signed(netResult(state.finance.season)),
            })}
          </p>
        </section>
      ) : (
        fixture && (
          <section class="card next-match">
            <h2>{H.nextMatch}</h2>
            <p>
              <strong>{format(H.fixture, { week: fixture.week, opponent: teamName(state, opponentOf(fixture)) })}</strong>
            </p>
            <p class="muted">
              {fixture.home === MY_TEAM_ID ? H.venueHome : H.venueAway}
              {opponentOf(fixture) === state.league.rivalId && <span class="tag derby">{H.derby}</span>}
            </p>
          </section>
        )
      )}

      <ObjectivesCard state={state} />

      <section class="card journal">
        <h2>{H.journal}</h2>
        {journal.length === 0 ? (
          <p class="muted">{H.emptyJournal}</p>
        ) : (
          <ul class="plain">
            {journal.map((entry, i) => (
              <li key={i}>
                <span class="muted">{format(texts.league.round, { week: entry.week })}</span>
                <span>{describeLog(entry, state)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div class="advance-bar">
        {state.currentMatch ? (
          <button type="button" class="button wide big" onClick={onOpenMatch}>
            {H.playMatch}
          </button>
        ) : state.events.pending ? (
          <button type="button" class="button wide big" onClick={() => setShowEvent(true)}>
            {texts.eventUi.answer}
          </button>
        ) : (
          <button type="button" class="button wide big" onClick={() => dispatch({ type: 'advance' })}>
            {over ? H.toOffseason : H.advance}
          </button>
        )}
      </div>

      {showAccounts && <FinanceSheet state={state} onClose={() => setShowAccounts(false)} />}
      {state.events.pending && showEvent && <EventSheet state={state} dispatch={dispatch} />}
    </div>
  );
}
