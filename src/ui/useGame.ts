import { useCallback, useEffect, useState } from 'preact/hooks';
import { applyAction, newGame, type Action } from '../core/game';
import type { GameState } from '../core/state';
import { loadGame, requestPersistentStorage, saveGame } from '../storage/save';
import { texts } from './i18n';

export type GameStatus = 'loading' | 'ready' | 'loadFailed';

/** Graine aléatoire : le hasard du navigateur n'est utilisé qu'ici, jamais dans le cœur. */
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

export function createGame(): GameState {
  return newGame({ seed: randomSeed(), now: new Date().toISOString(), clubName: texts.defaults.clubName });
}

/** Charge la partie au démarrage, puis l'enregistre à chaque changement d'état. */
export function useGame(onSaveError: () => void) {
  const [state, setState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<GameStatus>('loading');

  useEffect(() => {
    void requestPersistentStorage();
    loadGame()
      .then((saved) => {
        // On réenregistre aussitôt : une sauvegarde migrée est ainsi écrite à la version courante.
        const game = saved ?? createGame();
        setState(game);
        void saveGame(game, new Date().toISOString()).catch(onSaveError);
        setStatus('ready');
      })
      .catch(() => setStatus('loadFailed'));
  }, []);

  /** Remplace toute la partie (nouvelle partie, import) et l'enregistre. */
  const replace = useCallback(
    (next: GameState) => {
      setState(next);
      setStatus('ready');
      void saveGame(next, new Date().toISOString()).catch(onSaveError);
    },
    [onSaveError],
  );

  const dispatch = useCallback(
    (action: Action) => {
      setState((current) => {
        if (!current) return current;
        const next = applyAction(current, action);
        void saveGame(next, new Date().toISOString()).catch(onSaveError);
        return next;
      });
    },
    [onSaveError],
  );

  return { state, status, dispatch, replace };
}
