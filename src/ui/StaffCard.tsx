import balance from '../data/balance.json';
import { staffWeeklyCost } from '../core/economy';
import type { Action } from '../core/game';
import type { GameState, StaffRole } from '../core/state';
import { formatEuros } from './formatters';
import { format, texts } from './i18n';

const S = texts.staff;
const ROLES: StaffRole[] = ['physio', 'scout', 'analyst'];

const effectText = (role: StaffRole): string => {
  const B = balance.staff;
  if (role === 'physio') return format(S.effects.physio, { percent: Math.round((1 - B.physio.injuryFactor) * 100) });
  if (role === 'scout') return format(S.effects.scout, { offers: B.scout.offers, top: B.scout.topOffers });
  return format(S.effects.analyst, { percent: Math.round((B.analyst.strengthFactor - 1) * 100) });
};

/** Le staff du club : embauché ou licencié à tout moment, payé chaque semaine. */
export function StaffCard({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  return (
    <section class="card staff">
      <h2>{S.title}</h2>
      <p class="muted">{S.intro}</p>
      <ul class="plain staff-list">
        {ROLES.map((role) => {
          const hired = state.staff[role];
          const cost = balance.staff[role].weeklyCost;
          return (
            <li key={role} class="staff-role">
              <strong>
                {S.roles[role]} {hired && <span class="tag">{S.hired}</span>}
              </strong>
              <p class="muted">{effectText(role)}</p>
              <button
                type="button"
                class={hired ? 'button secondary wide' : 'button wide'}
                onClick={() => dispatch({ type: 'setStaff', role, hired: !hired })}
              >
                {hired ? S.fire : format(S.hire, { cost: formatEuros(cost) })}
              </button>
            </li>
          );
        })}
      </ul>
      <p>{format(S.total, { amount: formatEuros(staffWeeklyCost(state)) })}</p>
    </section>
  );
}
