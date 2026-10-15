import { useState } from 'preact/hooks';
import type { Action } from '../../core/game';
import { FORMATIONS, formationSlots } from '../../core/lineup';
import { overall, weeklyWages } from '../../core/players';
import type { Formation, GameState, Player, PlayStyle, Position } from '../../core/state';
import { formatEuros, formatStars } from '../formatters';
import { format, texts } from '../i18n';

const STYLES: PlayStyle[] = ['offensive', 'balanced', 'defensive'];

interface SquadScreenProps {
  state: GameState;
  dispatch: (action: Action) => void;
}

export function SquadScreen({ state, dispatch }: SquadScreenProps) {
  const { squad } = state;
  const [selected, setSelected] = useState<string | null>(null);
  const byId = new Map(squad.players.map((p) => [p.id, p]));
  const slots = formationSlots(squad.formation);
  const starters = new Set(squad.lineup);
  const bench = squad.players.filter((p) => !starters.has(p.id) && p.injuryWeeks <= 0);
  const unavailable = squad.players.filter((p) => !starters.has(p.id) && p.injuryWeeks > 0);
  const selectedPlayer = selected ? byId.get(selected) : undefined;

  const handleTap = (player: Player) => {
    if (!selected) return setSelected(player.id);
    if (selected === player.id) return setSelected(null);
    const oneIsStarter = starters.has(selected) || starters.has(player.id);
    const bothAvailable = player.injuryWeeks <= 0 && (selectedPlayer?.injuryWeeks ?? 0) <= 0;
    if (oneIsStarter && bothAvailable) {
      dispatch({ type: 'swapPlayers', a: selected, b: player.id });
      setSelected(null);
    } else {
      setSelected(player.id);
    }
  };

  const row = (player: Player | undefined, line: Position | null, key: string) => {
    if (!player) {
      return (
        <li key={key} class="player-row empty">
          <span class="pos">{line ? texts.positions[line] : ''}</span>
          <span class="name">{texts.squad.emptySlot}</span>
        </li>
      );
    }
    const outOfPosition = line !== null && line !== player.pos;
    return (
      <li key={key}>
        <button
          type="button"
          class={`player-row${selected === player.id ? ' selected' : ''}`}
          onClick={() => handleTap(player)}
        >
          <span class={`pos pos-${player.pos}${outOfPosition ? ' off' : ''}`}>{texts.positions[player.pos]}</span>
          <span class="name">
            {player.name}
            {player.injuryWeeks > 0 && (
              <small class="injury">{format(texts.squad.injured, { weeks: player.injuryWeeks })}</small>
            )}
          </span>
          <span class="stars">{formatStars(player.potentialStarsShown)}</span>
          <span class="rating">{overall(player)}</span>
        </button>
      </li>
    );
  };

  return (
    <div class="screen squad">
      <div class="card controls">
        <label class="field">
          <span>{texts.squad.formation}</span>
          <select
            value={squad.formation}
            onChange={(e) =>
              dispatch({ type: 'setFormation', formation: (e.currentTarget as HTMLSelectElement).value as Formation })
            }
          >
            {FORMATIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <div class="field">
          <span>{texts.squad.style}</span>
          <div class="segmented">
            {STYLES.map((style) => (
              <button
                key={style}
                type="button"
                class={squad.style === style ? 'active' : ''}
                onClick={() => dispatch({ type: 'setStyle', style })}
              >
                {texts.styles[style]}
              </button>
            ))}
          </div>
        </div>
        <label class="toggle">
          <span>{texts.squad.autoLineup}</span>
          <input
            type="checkbox"
            checked={squad.autoLineup}
            onChange={(e) => dispatch({ type: 'setAutoLineup', value: (e.currentTarget as HTMLInputElement).checked })}
          />
        </label>
        <p class="muted small">
          {texts.game.wages} : {format(texts.game.perWeek, { amount: formatEuros(weeklyWages(squad.players)) })}
        </p>
      </div>

      <h2>{texts.squad.starters}</h2>
      <ul class="player-list">{slots.map((line, i) => row(byId.get(squad.lineup[i] ?? ''), line, `s${i}`))}</ul>

      <h2>{texts.squad.bench}</h2>
      <ul class="player-list">{bench.map((p) => row(p, null, p.id))}</ul>

      {unavailable.length > 0 && (
        <>
          <h2>{texts.squad.unavailable}</h2>
          <ul class="player-list">{unavailable.map((p) => row(p, null, p.id))}</ul>
        </>
      )}

      {selectedPlayer && <PlayerPanel player={selectedPlayer} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PlayerPanel({ player, onClose }: { player: Player; onClose: () => void }) {
  const s = texts.squad.stats;
  const stats: [string, number][] = [
    [player.pos === 'GAR' ? s.saves : s.att, player.stats.att],
    [s.def, player.stats.def],
    [s.pas, player.stats.pas],
    [s.phy, player.stats.phy],
  ];
  return (
    <aside class="player-panel">
      <div class="panel-head">
        <strong>{player.name}</strong>
        <span class="muted">
          {texts.lines[player.pos]} · {format(texts.squad.age, { age: player.age })}
        </span>
        <button type="button" class="button secondary small-button" onClick={onClose}>
          {texts.squad.close}
        </button>
      </div>
      <dl class="stat-grid">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div>
          <dt>{texts.squad.morale}</dt>
          <dd>{player.morale}</dd>
        </div>
        <div>
          <dt>{texts.squad.potential}</dt>
          <dd>{formatStars(player.potentialStarsShown)}</dd>
        </div>
        <div>
          <dt>{texts.squad.salary}</dt>
          <dd>{format(texts.squad.perMonth, { amount: formatEuros(player.monthlySalary) })}</dd>
        </div>
        <div>
          <dt>{texts.squad.contract}</dt>
          <dd>{format(texts.squad.contractYears, { years: player.contractYears })}</dd>
        </div>
      </dl>
      <p class="muted small">{texts.squad.swapHint}</p>
    </aside>
  );
}
