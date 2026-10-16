import balance from '../data/balance.json';
import { averageRating } from '../core/playerStats';
import { contractedPlayers } from '../core/offseason';
import type { GameState, Player } from '../core/state';
import { cupRoundName } from './cupText';
import { formatEuros, formatInteger } from './formatters';
import { format, texts } from './i18n';
import { rankText, teamName } from './logText';

const S = texts.stats;
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TOP = 5;

function Leaders({ title, players, value }: { title: string; players: Player[]; value: (p: Player) => string }) {
  return (
    <section class="card">
      <h3>{title}</h3>
      {players.length === 0 ? (
        <p class="muted">{S.none}</p>
      ) : (
        <ol class="leaders">
          {players.map((p) => (
            <li key={p.id}>
              <span>
                <span class={`pos pos-${p.pos}`}>{texts.positions[p.pos]}</span> {p.name}
              </span>
              <strong>{value(p)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Une barre proportionnelle à la plus grande valeur de la série. */
function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const width = max > 0 ? Math.max(2, Math.round((Math.max(0, value) / max) * 100)) : 0;
  return (
    <div class="bar-row">
      <div class="bar" style={{ width: `${width}%` }} />
      <span>{label}</span>
    </div>
  );
}

/** Statistiques : meilleurs joueurs de la saison, saison par saison, bilan face à chaque adversaire. */
export function StatsView({ state }: { state: GameState }) {
  const players = contractedPlayers(state.squad.players);
  const by = (f: (p: Player) => number, min = 1) =>
    [...players].filter((p) => f(p) >= min).sort((a, b) => f(b) - f(a)).slice(0, TOP);
  const scorers = by((p) => p.seasonStats.goals);
  const assisters = by((p) => p.seasonStats.assists);
  const rated = [...players]
    .filter((p) => p.seasonStats.apps >= balance.stats.minAppsForRating)
    .sort((a, b) => (averageRating(b.seasonStats) ?? 0) - (averageRating(a.seasonStats) ?? 0))
    .slice(0, TOP);

  const history = state.records.history;
  const maxTreasury = Math.max(0, ...history.map((h) => h.treasury ?? 0));
  const maxAttendance = Math.max(0, ...history.map((h) => h.averageAttendance ?? 0));
  const opponents = Object.entries(state.records.headToHead).sort((a, b) => b[1].played - a[1].played);

  return (
    <div class="stats-view">
      <h2>{S.seasonTitle}</h2>
      <Leaders title={S.scorers} players={scorers} value={(p) => String(p.seasonStats.goals)} />
      <Leaders title={S.assists} players={assisters} value={(p) => String(p.seasonStats.assists)} />
      <Leaders
        title={format(S.ratings, { min: balance.stats.minAppsForRating })}
        players={rated}
        value={(p) => decimal.format(averageRating(p.seasonStats) ?? 0)}
      />

      <h2>{S.historyTitle}</h2>
      {history.length === 0 ? (
        <p class="muted">{S.noHistory}</p>
      ) : (
        <section class="card">
          {history.map((h) => {
            const run = state.records.cupRuns.find((c) => c.season === h.season);
            return (
              <div key={h.season} class="season-block">
                <p>
                  <strong>{format(S.seasonLine, { season: h.season })}</strong> ·{' '}
                  {rankText(h.rank)} {texts.divisions[h.division]}
                  {run && <small class="muted"> · 🏆 {run.won ? texts.cup.historyWon.replace(' · ', '') : cupRoundName(run.round)}</small>}
                </p>
                {h.treasury !== null && (
                  <Bar value={h.treasury} max={maxTreasury} label={format(S.treasury, { value: formatEuros(h.treasury) })} />
                )}
                {h.averageAttendance !== null && (
                  <Bar
                    value={h.averageAttendance}
                    max={maxAttendance}
                    label={format(S.attendance, { value: formatInteger(h.averageAttendance) })}
                  />
                )}
              </div>
            );
          })}
        </section>
      )}

      <h2>{S.h2hTitle}</h2>
      {opponents.length === 0 ? (
        <p class="muted">{S.none}</p>
      ) : (
        <table class="standings h2h">
          <thead>
            <tr>
              <th class="team-col">{S.opponent}</th>
              <th>{S.won}</th>
              <th>{S.drawn}</th>
              <th>{S.lost}</th>
              <th>{S.goals}</th>
            </tr>
          </thead>
          <tbody>
            {opponents.map(([id, h]) => (
              <tr key={id}>
                <td class="team-col">{teamName(state, id)}</td>
                <td>{h.won}</td>
                <td>{h.drawn}</td>
                <td>{h.lost}</td>
                <td>
                  {h.goalsFor}-{h.goalsAgainst}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
