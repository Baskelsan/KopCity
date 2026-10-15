import { useEffect, useState } from 'preact/hooks';
import type { Action } from '../../core/game';
import { bestReplacement } from '../../core/match';
import type { Decision, MatchEvent, MatchState } from '../../core/matchTypes';
import { overall } from '../../core/players';
import type { GameState, Player, PlayStyle } from '../../core/state';
import { format, texts } from '../i18n';
import { describeEvent, scoreAt, scoreLine } from '../matchText';
import { Sheet } from '../Sheet';

/** Durée d'affichage d'une minute de match en direct (90 minutes ≈ 1 minute réelle). */
const MS_PER_MINUTE = 650;
const FAST = 4;
const STYLES: PlayStyle[] = ['offensive', 'balanced', 'defensive'];

interface MatchScreenProps {
  state: GameState;
  dispatch: (action: Action) => void;
}

export function MatchScreen({ state, dispatch }: MatchScreenProps) {
  const match = state.currentMatch;
  // Un match lancé depuis cet écran se déroule depuis la 1re minute ; un match repris s'affiche là où il en était.
  const [startedHere, setStartedHere] = useState(false);

  if (!match) {
    const start = (live: boolean) => {
      setStartedHere(true);
      dispatch({ type: 'startFriendly', live });
    };
    return (
      <div class="screen">
        <section class="card">
          <h2>{texts.match.friendlyTitle}</h2>
          <p class="muted">{texts.match.friendlyText}</p>
          <div class="actions">
            {!state.settings.alwaysLiveMatches && (
              <button type="button" class="button secondary" onClick={() => start(false)}>
                {texts.match.playSummary}
              </button>
            )}
            <button
              type="button"
              class={`button${state.settings.alwaysLiveMatches ? ' wide' : ''}`}
              onClick={() => start(true)}
            >
              {texts.match.playLive}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!match.live) {
    return <MatchReport state={state} match={match} onFinish={() => dispatch({ type: 'finishMatch' })} />;
  }
  return <LiveMatch state={state} match={match} dispatch={dispatch} fromStart={startedHere} />;
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

function MatchReport({ state, match, onFinish }: { state: GameState; match: MatchState; onFinish: () => void }) {
  const players = new Map(state.squad.players.map((p) => [p.id, p]));
  const clubSide = match.club.side;
  const opponentSide = clubSide === 'home' ? 'away' : 'home';
  const scorers = match.events
    .filter((e): e is Extract<MatchEvent, { type: 'chance' }> => e.type === 'chance')
    .filter((e) => e.outcome === 'goal' && e.side === clubSide)
    .map((e) => `${players.get(e.playerId ?? '')?.name ?? ''} ${format(texts.match.minute, { minute: e.minute })}`);
  const opponentGoals = match.score[opponentSide];
  const highlights = match.events.filter((e) => e.type === 'injury' || e.type === 'card' || e.type === 'substitution').slice(0, 3);

  return (
    <div class="screen">
      <div class="card scoreboard">
        <span class="team">{match.home.name}</span>
        <strong class="score">
          {match.score.home} - {match.score.away}
        </strong>
        <span class="team">{match.away.name}</span>
      </div>
      <section class="card">
        <h2>{texts.match.scorers}</h2>
        {scorers.length === 0 && opponentGoals === 0 && <p class="muted">{texts.match.noScorer}</p>}
        <ul class="plain">
          {scorers.map((s, i) => (
            <li key={i}>⚽ {s}</li>
          ))}
          {opponentGoals > 0 && (
            <li class="muted">{format(texts.match.opponentGoals, { team: match[opponentSide].name, count: opponentGoals })}</li>
          )}
        </ul>
        <h2>{texts.match.highlights}</h2>
        {highlights.length === 0 ? (
          <p class="muted">{texts.match.nothingToReport}</p>
        ) : (
          <ol class="feed">
            {highlights.map((event, i) => (
              <FeedLine key={i} event={event} match={match} players={players} />
            ))}
          </ol>
        )}
      </section>
      <div class="actions">
        <button type="button" class="button wide" onClick={onFinish}>
          {texts.match.finish}
        </button>
      </div>
    </div>
  );
}
