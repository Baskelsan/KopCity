import objectivesData from '../data/objectives.json';
import { myDivision } from '../core/league';
import { objectiveProgress, SETTLED_EARLY } from '../core/objectives';
import type { GameState, Objective } from '../core/state';
import { formatEuros } from './formatters';
import { format, texts } from './i18n';

const O = texts.objectives;

function progressText(state: GameState, objective: Objective): string {
  const p = objectiveProgress(state, objective);
  const started = myDivision(state.league).table.some((r) => r.played > 0);
  if (objective.type === 'rankAtMost' && !started) return O.notStarted;
  const money = objective.type === 'treasuryAtLeast' || objective.type === 'seasonNetPositive';
  const show = (v: number) => (money ? formatEuros(v) : String(v));
  const template = O.progress[objective.type as keyof typeof O.progress] ?? '';
  return format(template, { current: show(p.current), target: show(p.target) });
}

export function ObjectivesCard({ state }: { state: GameState }) {
  if (state.objectives.length === 0) return null;
  const reward = Math.round(
    objectivesData.reward * objectivesData.rewardDivisionFactor[state.league.myDivision],
  );
  return (
    <section class="card objectives">
      <h2>{O.title}</h2>
      <ul class="plain">
        {state.objectives.map((o) => {
          const done = objectiveProgress(state, o).done;
          return (
            <li key={o.id} class={done ? 'done' : ''}>
              <span>
                {done ? '✓ ' : ''}
                {O.items[o.id as keyof typeof O.items]}
              </span>
              <small class="muted">{done ? (SETTLED_EARLY.has(o.type) ? O.done : O.onTrack) : progressText(state, o)}</small>
            </li>
          );
        })}
      </ul>
      <p class="muted small">{format(O.reward, { reward: formatEuros(reward) })}</p>
    </section>
  );
}
