import { choiceRefusal, eventSpec } from '../core/events';
import type { Action } from '../core/game';
import type { GameState } from '../core/state';
import { describeEffect, eventParams, eventTexts } from './eventText';
import { format, texts } from './i18n';
import { Sheet } from './Sheet';

/** L'événement en cours : 2 choix, avec leurs effets chiffrés avant de décider. Il faut choisir pour fermer. */
export function EventSheet({ state, dispatch }: { state: GameState; dispatch: (action: Action) => void }) {
  const pending = state.events.pending;
  if (!pending) return null;
  const spec = eventSpec(pending.eventId);
  const t = eventTexts(pending.eventId);
  const params = eventParams(state, pending);

  return (
    <Sheet title={t.title}>
      <p>{format(t.text, params)}</p>
      <div class="build-options">
        {spec.choices.map((choice) => {
          const refusal = choiceRefusal(state, choice);
          const label = t.choices[choice.id as keyof typeof t.choices];
          return (
            <section key={choice.id} class="build-option">
              <h3>{label}</h3>
              <ul class="effects">
                {choice.effects.length === 0 ? (
                  <li>{texts.effects.nothing}</li>
                ) : (
                  choice.effects.map((effect, i) => <li key={i}>{describeEffect(effect, params)}</li>)
                )}
              </ul>
              {refusal ? (
                <p class="refusal">{texts.effects.refusals[refusal]}</p>
              ) : (
                <button
                  type="button"
                  class="button wide"
                  onClick={() => dispatch({ type: 'resolveEvent', choiceId: choice.id })}
                >
                  {label}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}
