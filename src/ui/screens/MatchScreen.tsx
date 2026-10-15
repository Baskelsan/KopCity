import { useEffect, useState } from 'preact/hooks';
import balance from '../../data/balance.json';
import type { Action } from '../../core/game';
import { DIVISIONS, myDivision, standings } from '../../core/league';
import { bestReplacement } from '../../core/match';
import type { Decision, MatchEvent, MatchState } from '../../core/matchTypes';
import { overall } from '../../core/players';
import { MY_TEAM_ID, type DivisionId, type GameState, type Player, type PlayStyle } from '../../core/state';
import { format, texts } from '../i18n';
import { teamName } from '../logText';
import { describeEvent, scoreAt, scoreLine } from '../matchText';
import { Sheet } from '../Sheet';

/** Durée d'affichage d'une minute de match en direct (90 minutes ≈ 1 minute réelle). */
const MS_PER_MINUTE = 650;
const FAST = 4;
const STYLES: PlayStyle[] = ['offensive', 'balanced', 'defensive'];

interface MatchScreenProps {
  state: GameState;
  dispatch: (action: Action) => void;
  /** true : le match vient d'être lancé, on le déroule depuis la 1re minute. */
  liveFromStart: boolean;
}

export function MatchScreen({ state, dispatch, liveFromStart }: MatchScreenProps) {
  const match = state.currentMatch;
  if (!match) return <LeagueView state={state} />;
  return <LiveMatch state={state} match={match} dispatch={dispatch} fromStart={liveFromStart} />;
}

function LiveMatch({
  state,
  match,
  dispatch,
  fromStart,
}: {
  state: GameState;
  match: MatchState;
  dispatch: (action: Action) => void;
  fromStart: boolean;
}) {
  const [shown, setShown] = useState(fromStart ? 0 : match.minute);
  const [speed, setSpeed] = useState(1);
  const players = new Map(state.squad.players.map((p) => [p.id, p]));
  const caughtUp = shown >= match.minute;

  useEffect(() => {
    if (caughtUp) return;
    const timer = setTimeout(() => setShown((m) => Math.min(m + 1, match.minute)), MS_PER_MINUTE / speed);
    return () => clearTimeout(timer);
  }, [shown, match.minute, speed, caughtUp]);

  const visible = match.events.filter((e) => e.minute <= shown);
  const score = scoreAt(match, shown);
  const pending = caughtUp ? match.pending[0] : undefined;

  return (
    <div class="screen live">
      <div class="card scoreboard">
        <span class="team">{match.home.name}</span>
        <strong class="score">
          {score.home} - {score.away}
        </strong>
        <span class="team">{match.away.name}</span>
        <span class="clock">{format(texts.match.minute, { minute: shown })}</span>
      </div>

      {!match.finished || !caughtUp ? (
        <div class="segmented speed">
          <button type="button" class={speed === 1 ? 'active' : ''} onClick={() => setSpeed(1)}>
            {texts.match.speedNormal}
          </button>
          <button type="button" class={speed === FAST ? 'active' : ''} onClick={() => setSpeed(FAST)}>
            {texts.match.speedFast}
          </button>
          <button type="button" onClick={() => setShown(match.minute)}>
            {texts.match.skip}
          </button>
        </div>
      ) : (
        <div class="actions">
          <button type="button" class="button wide" onClick={() => dispatch({ type: 'finishMatch' })}>
            {texts.match.finish}
          </button>
        </div>
      )}

      <ol class="feed">
        {[...visible].reverse().map((event, i) => (
          <FeedLine key={`${visible.length - i}`} event={event} match={match} players={players} />
        ))}
      </ol>

      {pending && (
        <DecisionSheet
          match={match}
          state={state}
          players={players}
          onDecide={(decision) => dispatch({ type: 'matchDecision', decision })}
        />
      )}
    </div>
  );
}

function FeedLine({ event, match, players }: { event: MatchEvent; match: MatchState; players: Map<string, Player> }) {
  const goal = event.type === 'chance' && event.outcome === 'goal';
  return (
    <li class={goal ? 'goal' : ''}>
      <span class="minute">{format(texts.match.minute, { minute: event.minute })}</span>
      <span>{describeEvent(event, match, players)}</span>
    </li>
  );
}

function DecisionSheet({
  match,
  state,
  players,
  onDecide,
}: {
  match: MatchState;
  state: GameState;
  players: Map<string, Player>;
  onDecide: (decision: Decision) => void;
}) {
  const D = texts.match.decisions;
  const pending = match.pending[0];
  if (!pending) return null;

  if (pending.type === 'halftime') {
    return (
      <Sheet title={D.halftimeTitle}>
        <p>{scoreLine(match)}</p>
        <p class="muted">{D.halftimeText}</p>
        <div class="choice-list">
          {STYLES.map((style) => (
            <button
              key={style}
              type="button"
              class={`button${style === match.club.style ? '' : ' secondary'}`}
              onClick={() => onDecide({ type: 'halftime', style })}
            >
              {style === match.club.style ? format(D.current, { label: texts.styles[style] }) : texts.styles[style]}
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  if (pending.type === 'late') {
    return (
      <Sheet title={format(D.lateTitle, { minute: match.minute })}>
        <p>{scoreLine(match)}</p>
        <p class="muted">{D.lateText}</p>
        <div class="choice-list">
          <button type="button" class="button secondary" onClick={() => onDecide({ type: 'late', choice: 'force' })}>
            {D.force}
            <small>{D.forceHint}</small>
          </button>
          <button type="button" class="button secondary" onClick={() => onDecide({ type: 'late', choice: 'manage' })}>
            {D.manage}
            <small>{D.manageHint}</small>
          </button>
          <button type="button" class="button" onClick={() => onDecide({ type: 'late', choice: 'keep' })}>
            {D.keep}
          </button>
        </div>
      </Sheet>
    );
  }

  const ctx = { players: state.squad.players, formation: state.squad.formation };
  const best = bestReplacement(match, pending.slot, ctx);
  const options = match.club.bench
    .map((id) => players.get(id))
    .filter((p): p is Player => p !== undefined)
    .sort((a, b) => (a.id === best ? -1 : b.id === best ? 1 : overall(b) - overall(a)));
  return (
    <Sheet title={D.injuryTitle}>
      <p>{format(D.injuryText, { player: players.get(pending.playerId)?.name ?? '' })}</p>
      <div class="choice-list">
        {options.map((p) => (
          <button
            key={p.id}
            type="button"
            class={`button${p.id === best ? '' : ' secondary'}`}
            onClick={() => onDecide({ type: 'injury', replacementId: p.id })}
          >
            {texts.positions[p.pos]} · {p.name} · {overall(p)}
            {p.id === best && <small>{D.recommended}</small>}
          </button>
        ))}
        <button type="button" class="button secondary" onClick={() => onDecide({ type: 'injury', replacementId: null })}>
          {D.playWithTen}
        </button>
      </div>
    </Sheet>
  );
}

function LeagueView({ state }: { state: GameState }) {
  const [view, setView] = useState<'calendar' | 'table'>('calendar');
  const [shownDivision, setShownDivision] = useState<DivisionId>(state.league.myDivision);
  const division = myDivision(state.league);
  const tableDivision = state.league.divisions.find((d) => d.id === shownDivision) ?? division;
  const G = texts.league;
  const mine = division.fixtures
    .filter((f) => f.home === MY_TEAM_ID || f.away === MY_TEAM_ID)
    .sort((a, b) => a.week - b.week);

  return (
    <div class="screen">
      <div class="segmented">
        <button type="button" class={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>
          {G.calendar}
        </button>
        <button type="button" class={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
          {G.table}
        </button>
      </div>

      {view === 'calendar' ? (
        <ol class="calendar">
          {mine.map((f) => {
            const home = f.home === MY_TEAM_ID;
            const opponent = home ? f.away : f.home;
            const r = f.result;
            const scored = r ? (home ? r.homeGoals : r.awayGoals) : 0;
            const conceded = r ? (home ? r.awayGoals : r.homeGoals) : 0;
            const outcome = !r ? '' : scored > conceded ? 'win' : scored < conceded ? 'loss' : 'draw';
            return (
              <li key={f.week} class={`${f.week === state.time.week ? 'current ' : ''}${outcome}`}>
                <span class="muted">{format(G.round, { week: f.week })}</span>
                <span>
                  {teamName(state, opponent)}
                  {opponent === state.league.rivalId && <span class="tag derby">{texts.home.derby}</span>}
                  <small class="muted"> · {home ? texts.venueShort.home : texts.venueShort.away}</small>
                </span>
                <strong>{r ? `${scored}-${conceded}` : G.notPlayed}</strong>
              </li>
            );
          })}
        </ol>
      ) : (
        <>
        <div class="segmented division-picker">
          {[...DIVISIONS].reverse().map((id) => (
            <button key={id} type="button" class={shownDivision === id ? 'active' : ''} onClick={() => setShownDivision(id)}>
              {texts.divisions[id]}
            </button>
          ))}
        </div>
        <table class="standings">
          <thead>
            <tr>
              <th>{G.rank}</th>
              <th class="team-col">{G.team}</th>
              <th>{G.played}</th>
              <th>{G.goalDiff}</th>
              <th>{G.points}</th>
            </tr>
          </thead>
          <tbody>
            {standings(tableDivision.table).map((row, i) => (
              <tr
                key={row.team}
                class={[
                  row.team === MY_TEAM_ID ? 'mine' : '',
                  i + 1 === balance.keyMatch.promotionSpots ? 'promotion-line' : '',
                  i + 1 === tableDivision.table.length - balance.keyMatch.relegationSpots ? 'relegation-line' : '',
                ].join(' ')}
              >
                <td>{i + 1}</td>
                <td class="team-col">{teamName(state, row.team)}</td>
                <td>{row.played}</td>
                <td>{row.goalsFor - row.goalsAgainst}</td>
                <td>
                  <strong>{row.points}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </>
      )}
    </div>
  );
}
