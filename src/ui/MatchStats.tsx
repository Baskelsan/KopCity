import balance from '../data/balance.json';
import { currentStrength } from '../core/match';
import type { MatchState, Side } from '../core/matchTypes';
import type { GameState } from '../core/state';
import { format, texts } from './i18n';

const T = texts.matchStats;

interface SideStats {
  chances: number;
  onTarget: number;
  cards: number;
}

/** Statistiques du match jusqu'à la minute affichée. */
export function statsAt(match: MatchState, minute: number): Record<Side, SideStats> {
  const stats: Record<Side, SideStats> = {
    home: { chances: 0, onTarget: 0, cards: 0 },
    away: { chances: 0, onTarget: 0, cards: 0 },
  };
  for (const e of match.events) {
    if (e.minute > minute) break;
    if (e.type === 'chance') {
      stats[e.side].chances++;
      if (e.outcome !== 'off') stats[e.side].onTarget++;
    }
    if (e.type === 'card') stats[e.side].cards++;
  }
  return stats;
}

/**
 * Part du milieu de terrain de l'équipe à domicile, avec les forces actuelles (style, choix de fin de match,
 * blessures) : c'est elle qui décide qui se crée les occasions.
 */
export function midfieldShare(match: MatchState, state: GameState): number {
  const ctx = { players: state.squad.players, formation: state.squad.formation };
  const e = balance.match.midfieldExponent;
  const home = Math.pow(Math.max(currentStrength(match, 'home', ctx).mid, 0.01), e);
  const away = Math.pow(Math.max(currentStrength(match, 'away', ctx).mid, 0.01), e);
  return home / (home + away);
}

function Row({ label, home, away, share }: { label: string; home: string; away: string; share?: number }) {
  return (
    <div class="ms-row">
      <span class="ms-value">{home}</span>
      <span class="ms-label">
        {label}
        {share !== undefined && (
          <span class="ms-bar" aria-hidden="true">
            <span style={{ width: `${Math.round(share * 100)}%` }} />
          </span>
        )}
      </span>
      <span class="ms-value">{away}</span>
    </div>
  );
}

/** Tableau des statistiques : domination, occasions, tirs cadrés, cartons. */
export function MatchStats({ match, state, minute }: { match: MatchState; state: GameState; minute: number }) {
  const s = statsAt(match, minute);
  const share = midfieldShare(match, state);
  const chanceShare = s.home.chances + s.away.chances > 0 ? s.home.chances / (s.home.chances + s.away.chances) : 0.5;
  const pct = (x: number) => format(T.percent, { value: Math.round(x * 100) });
  return (
    <section class="card match-stats" aria-label={T.title}>
      <Row label={T.domination} home={pct(share)} away={pct(1 - share)} share={share} />
      <Row label={T.chances} home={String(s.home.chances)} away={String(s.away.chances)} share={chanceShare} />
      <Row label={T.onTarget} home={String(s.home.onTarget)} away={String(s.away.onTarget)} />
      <Row label={T.cards} home={String(s.home.cards)} away={String(s.away.cards)} />
      <p class="muted small">{T.hint}</p>
    </section>
  );
}
