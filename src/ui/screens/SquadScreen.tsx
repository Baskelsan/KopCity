import { useState } from 'preact/hooks';
import type { Action } from '../../core/game';
import { FORMATIONS, formationSlots } from '../../core/lineup';
import { canRemovePlayer, contractedPlayers } from '../../core/offseason';
import { averageRating } from '../../core/playerStats';
import { overall, saleValue, weeklyWages } from '../../core/players';
import type { Formation, GameState, Player, PlayerSeasonStats, PlayStyle, Position } from '../../core/state';
import { formatEuros, formatStars } from '../formatters';
import { format, texts } from '../i18n';
import { MarketSheet, refusalText } from '../MarketSheet';

const STYLES: PlayStyle[] = ['offensive', 'balanced', 'defensive'];
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** « Cette saison : 12 matchs · 3 buts · 2 passes déc. — Note moyenne : 6,8 / 10 ». */
function StatsLine({ label, stats }: { label: string; stats: PlayerSeasonStats }) {
  const rating = averageRating(stats);
  return (
    <p class="stats-line">
      <strong>{label}</strong>
      <span>
        {stats.apps === 0
          ? texts.squad.statsNone
          : format(texts.squad.statsLine, { apps: stats.apps, goals: stats.goals, assists: stats.assists })}
      </span>
      {rating !== null && <span class="muted">{format(texts.squad.statsRating, { rating: decimal.format(rating) })}</span>}
    </p>
  );
}

interface SquadScreenProps {
  state: GameState;
  dispatch: (action: Action) => void;
}

export function SquadScreen({ state, dispatch }: SquadScreenProps) {
  const { squad } = state;
  const [selected, setSelected] = useState<string | null>(null);
  const [showMarket, setShowMarket] = useState(false);
  const marketOpen = state.market.open;
  // Pendant l'intersaison, les joueurs en fin de contrat ne font plus partie de l'effectif tant qu'ils ne sont pas prolongés.
  const players = contractedPlayers(squad.players);
  const expiringCount = squad.players.length - players.length;
  const byId = new Map(players.map((p) => [p.id, p]));
  const slots = formationSlots(squad.formation);
  const starters = new Set(squad.lineup);
  const bench = players.filter((p) => !starters.has(p.id) && p.injuryWeeks <= 0);
  const unavailable = players.filter((p) => !starters.has(p.id) && p.injuryWeeks > 0);
  const selectedPlayer = selected ? byId.get(selected) : undefined;

  /**
   * Toucher deux joueurs les échange. Un titulaire blessé peut être sorti : seul le joueur
   * qui entre dans le onze doit être disponible.
   */
  const handleTap = (player: Player) => {
    if (!selected) return setSelected(player.id);
    if (selected === player.id) return setSelected(null);
    const selectedStarts = starters.has(selected);
    const tappedStarts = starters.has(player.id);
    const incoming = selectedStarts && !tappedStarts ? player : !selectedStarts && tappedStarts ? selectedPlayer : null;
    const allowed = (selectedStarts || tappedStarts) && (incoming === null || (incoming?.injuryWeeks ?? 1) <= 0);
    if (allowed) {
      dispatch({ type: 'swapPlayers', a: selected, b: player.id });
      setSelected(null);
    } else {
      setSelected(player.id);
    }
  };

  /** Une place vide se remplit avec le joueur sélectionné (s'il est disponible). */
  const handleEmptySlot = (slot: number) => {
    if (!selectedPlayer || selectedPlayer.injuryWeeks > 0) return;
    dispatch({ type: 'placePlayer', slot, playerId: selectedPlayer.id });
    setSelected(null);
  };

  const row = (player: Player | undefined, line: Position | null, key: string) => {
    if (!player) {
      const slot = Number(key.slice(1));
      return (
        <li key={key}>
          <button type="button" class="player-row empty" onClick={() => handleEmptySlot(slot)}>
            <span class="pos">{line ? texts.positions[line] : ''}</span>
            <span class="name">{texts.squad.emptySlot}</span>
          </button>
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
            {player.seasonStats.apps > 0 && (
              <small class="muted">
                {format(texts.squad.rowStats, {
                  rating: decimal.format(averageRating(player.seasonStats) ?? 0),
                  goals: player.seasonStats.goals,
                  assists: player.seasonStats.assists,
                })}
              </small>
            )}
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
      {marketOpen && state.phase === 'season' && (
        <div class="card market-banner">
          <strong>{texts.market.openBanner}</strong>
          <button type="button" class="button" onClick={() => setShowMarket(true)}>
            {format(texts.market.openButton, { count: state.market.offers.length })}
          </button>
        </div>
      )}
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
          {texts.game.wages} : {format(texts.game.perWeek, { amount: formatEuros(weeklyWages(players)) })}
        </p>
      </div>

      {expiringCount > 0 && (
        <p class="muted small">{format(texts.squad.expiringHidden, { count: expiringCount })}</p>
      )}
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

      {selectedPlayer && (
        <PlayerPanel
          player={selectedPlayer}
          state={state}
          onClose={() => setSelected(null)}
          onSell={() => {
            const amount = formatEuros(saleValue(selectedPlayer));
            if (window.confirm(format(texts.market.confirmSell, { player: selectedPlayer.name, amount }))) {
              dispatch({ type: 'sellPlayer', playerId: selectedPlayer.id });
              setSelected(null);
            }
          }}
        />
      )}
      {showMarket && <MarketSheet state={state} dispatch={dispatch} onClose={() => setShowMarket(false)} />}
    </div>
  );
}

function PlayerPanel({
  player,
  state,
  onClose,
  onSell,
}: {
  player: Player;
  state: GameState;
  onClose: () => void;
  onSell: () => void;
}) {
  const canSellNow = state.phase === 'offseason' || state.market.open;
  const sellCheck = canRemovePlayer(state);
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
      <h3 class="panel-subtitle">{texts.squad.statsTitle}</h3>
      <StatsLine label={texts.squad.statsSeason} stats={player.seasonStats} />
      <StatsLine label={texts.squad.statsCareer} stats={player.careerStats} />
      <p class="muted small">{texts.squad.swapHint}</p>
      {canSellNow &&
        (sellCheck.ok ? (
          <button type="button" class="button secondary wide" onClick={onSell}>
            {format(texts.market.sell, { amount: formatEuros(saleValue(player)) })}
          </button>
        ) : (
          <p class="refusal">{refusalText(sellCheck)}</p>
        ))}
    </aside>
  );
}
