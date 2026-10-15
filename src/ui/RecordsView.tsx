import { useEffect, useState } from 'preact/hooks';
import type { GameSummary } from '../core/records';
import { topScorer } from '../core/records';
import type { GameState } from '../core/state';
import { loadHallOfFame } from '../storage/hallOfFame';
import { formatEuros, formatInteger } from './formatters';
import { format, texts } from './i18n';
import { rankText } from './logText';

const R = texts.records;

/** Palmarès de la partie en cours. */
export function RecordsView({ state }: { state: GameState }) {
  const { records } = state;
  const best = topScorer(records);
  return (
    <section class="card records">
      <h2>{R.title}</h2>
      <h3>{R.titles}</h3>
      {records.titles.length === 0 ? (
        <p class="muted">{R.noTitle}</p>
      ) : (
        <ul class="plain">
          {records.titles.map((t) => (
            <li key={t.season}>🏆 {format(R.titleItem, { division: texts.divisions[t.division], season: t.season })}</li>
          ))}
        </ul>
      )}
      <dl class="summary wide-summary">
        <div>
          <dt>{R.promotions}</dt>
          <dd>{records.promotions}</dd>
        </div>
        <div>
          <dt>{R.bestAttendance}</dt>
          <dd>{formatInteger(records.bestAttendance)}</dd>
        </div>
        <div>
          <dt>{R.bestTreasury}</dt>
          <dd>{formatEuros(records.bestTreasury)}</dd>
        </div>
        <div>
          <dt>{R.topScorer}</dt>
          <dd>{best ? format(R.scorerValue, { name: best.name, goals: best.goals }) : R.noScorer}</dd>
        </div>
      </dl>
      {records.history.length > 0 && (
        <>
          <h3>{R.history}</h3>
          <ul class="plain">
            {records.history.map((h) => (
              <li key={h.season}>
                {format(R.historyItem, { season: h.season, rank: rankText(h.rank), division: texts.divisions[h.division] })}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Parties terminées (faillites), pour comparer ses parties successives. */
export function PastGames({ refresh = 0 }: { refresh?: number }) {
  const [games, setGames] = useState<GameSummary[]>([]);
  useEffect(() => {
    void loadHallOfFame().then(setGames).catch(() => setGames([]));
  }, [refresh]);
  return (
    <section class="card">
      <h2>{R.pastGames}</h2>
      {games.length === 0 ? (
        <p class="muted">{R.noPastGame}</p>
      ) : (
        <ul class="plain">
          {[...games].reverse().map((g, i) => (
            <li key={i}>
              {format(R.pastGame, {
                club: g.clubName,
                seasons: g.seasons,
                titles: g.titles.length,
                division: texts.divisions[g.bestDivision],
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
