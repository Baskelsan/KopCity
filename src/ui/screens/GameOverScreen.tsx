import { gameSummary } from '../../core/records';
import type { GameState } from '../../core/state';
import { addToHallOfFame } from '../../storage/hallOfFame';
import { format, texts } from '../i18n';
import { RecordsView } from '../RecordsView';

/** Faillite : le bilan de la partie, gardé à part, puis une nouvelle partie. */
export function GameOverScreen({ state, onNewGame }: { state: GameState; onNewGame: () => void }) {
  const G = texts.gameOver;
  const startNewGame = async () => {
    try {
      await addToHallOfFame(gameSummary(state, new Date().toISOString()));
    } finally {
      onNewGame();
    }
  };
  return (
    <div class="screen home-screen">
      <h1>{G.title}</h1>
      <p>{format(G.text, { season: state.gameOver?.season ?? state.time.season, week: state.gameOver?.week ?? state.time.week })}</p>
      <h2>{G.summary}</h2>
      <RecordsView state={state} />
      <div class="advance-bar">
        <button type="button" class="button wide big" onClick={() => void startNewGame()}>
          {G.newGame}
        </button>
      </div>
    </div>
  );
}
