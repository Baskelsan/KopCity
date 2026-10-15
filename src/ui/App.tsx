import { useCallback, useRef, useState } from 'preact/hooks';
import { SaveError } from '../storage/errors';
import { exportSaveFile, readSaveFile } from '../storage/files';
import { format, texts } from './i18n';
import { UpdateBanner } from './UpdateBanner';
import { createGame, useGame } from './useGame';

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const integers = new Intl.NumberFormat('fr-FR');

export function App() {
  const [message, setMessage] = useState<string | null>(null);
  const onSaveError = useCallback(() => setMessage(texts.save.saveFailed), []);
  const { state, status, dispatch, replace } = useGame(onSaveError);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleNewGame = () => {
    if (!window.confirm(texts.save.confirmNewGame)) return;
    replace(createGame());
    setMessage(texts.save.newGameStarted);
  };

  const handleExport = async () => {
    if (!state) return;
    try {
      await exportSaveFile(state, new Date().toISOString());
      setMessage(texts.save.exported);
    } catch {
      setMessage(texts.save.exportFailed);
    }
  };

  const handleImportFile = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const imported = await readSaveFile(file);
      const question = format(texts.save.confirmImport, {
        club: imported.club.name,
        season: imported.time.season,
        week: imported.time.week,
      });
      if (!window.confirm(question)) return;
      replace(imported);
      setMessage(texts.save.imported);
    } catch (error) {
      setMessage(error instanceof SaveError ? texts.saveErrors[error.code] : texts.saveErrors.invalidFormat);
    }
  };

  return (
    <div class="app">
      <main class="home">
        <div class="crest" aria-hidden="true">{texts.app.monogram}</div>
        {status === 'loading' && <p class="muted">{texts.app.loading}</p>}
        {status === 'loadFailed' && <p>{texts.save.loadFailed}</p>}
        {state && (
          <>
            <h1>{state.club.name}</h1>
            <p class="muted">
              {format(texts.game.seasonWeek, { season: state.time.season, week: state.time.week })}
            </p>
            <dl class="summary">
              <div>
                <dt>{texts.game.treasury}</dt>
                <dd>{euros.format(state.club.treasury)}</dd>
              </div>
              <div>
                <dt>{texts.game.population}</dt>
                <dd>{integers.format(state.city.population)}</dd>
              </div>
              <div>
                <dt>{texts.game.seed}</dt>
                <dd>{state.meta.seed}</dd>
              </div>
            </dl>
            <label class="toggle">
              <span>{texts.game.alwaysLiveMatches}</span>
              <input
                type="checkbox"
                checked={state.settings.alwaysLiveMatches}
                onChange={(e) =>
                  dispatch({ type: 'setAlwaysLiveMatches', value: (e.currentTarget as HTMLInputElement).checked })
                }
              />
            </label>
          </>
        )}
        {message && (
          <p class="message" role="status">
            {message}
          </p>
        )}
      </main>

      <nav class="actions">
        <button type="button" class="button" disabled={!state} onClick={() => void handleExport()}>
          {texts.save.export}
        </button>
        <button type="button" class="button secondary" onClick={() => fileInput.current?.click()}>
          {texts.save.import}
        </button>
        <button type="button" class="button secondary wide" onClick={handleNewGame}>
          {texts.save.newGame}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void handleImportFile(e)}
        />
      </nav>
      <footer class="footer">
        <span class="version">{format(texts.app.version, { version: __APP_VERSION__ })}</span>
      </footer>
      <UpdateBanner />
    </div>
  );
}
