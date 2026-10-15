import { weeklyWages } from '../../core/players';
import type { GameState } from '../../core/state';
import { formatEuros, formatInteger } from '../formatters';
import { format, texts } from '../i18n';

export function HomeScreen({ state }: { state: GameState }) {
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
          <dt>{texts.game.population}</dt>
          <dd>{formatInteger(state.city.population)}</dd>
        </div>
      </dl>
    </div>
  );
}
