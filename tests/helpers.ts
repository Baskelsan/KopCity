// Outils partagés par les tests : jouer comme le ferait un joueur qui garde les choix par défaut.
import { applyAction } from '../src/core/game';
import { choiceRefusal, eventSpec } from '../src/core/events';
import { defaultDecision } from '../src/core/match';
import type { GameState } from '../src/core/state';

/** Répond à l'événement en cours avec le premier choix possible. */
export function resolvePendingEvent(state: GameState): GameState {
  const pending = state.events.pending;
  if (!pending) return state;
  const choice = eventSpec(pending.eventId).choices.find((c) => choiceRefusal(state, c) === null);
  if (!choice) throw new Error(`Aucun choix possible pour ${pending.eventId}`);
  return applyAction(state, { type: 'resolveEvent', choiceId: choice.id });
}

/** Termine le match en direct en cours avec les choix par défaut. */
export function finishLiveMatch(state: GameState): GameState {
  let s = state;
  while (!s.currentMatch!.finished) {
    const ctx = { players: s.squad.players, formation: s.squad.formation };
    s = applyAction(s, { type: 'matchDecision', decision: defaultDecision(s.currentMatch!, ctx) });
  }
  return applyAction(s, { type: 'finishMatch' });
}

/** Un appui sur « Avancer », suivi des réponses par défaut à ce qui l'a arrêté. */
export function advanceAndHandle(state: GameState): GameState {
  let s = applyAction(state, { type: 'advance' });
  if (s.events.pending) s = resolvePendingEvent(s);
  if (s.currentMatch) s = finishLiveMatch(s);
  return s;
}
