import { useRef } from 'preact/hooks';
import type { Action } from '../../core/game';
import type { GameState } from '../../core/state';
import { SaveError } from '../../storage/errors';
import { exportSaveFile, readSaveFile } from '../../storage/files';
import { format, texts } from '../i18n';
import { createGame } from '../useGame';

interface ClubScreenProps {
  state: GameState;
  dispatch: (action: Action) => void;
  replace: (state: GameState) => void;
  notify: (message: string) => void;
}

export function ClubScreen({ state, dispatch, replace, notify }: ClubScreenProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  const handleNewGame = () => {
    if (!window.confirm(texts.save.confirmNewGame)) return;
    replace(createGame());
    notify(texts.save.newGameStarted);
  };

  const handleExport = async () => {
    try {
      await exportSaveFile(state, new Date().toISOString());
      notify(texts.save.exported);
    } catch {
      notify(texts.save.exportFailed);
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
      notify(texts.save.imported);
    } catch (error) {
      notify(error instanceof SaveError ? texts.saveErrors[error.code] : texts.saveErrors.invalidFormat);
    }
  };

  return (
    <div class="screen">
      <h2>{texts.settings.title}</h2>
      <label class="card toggle">
        <span>{texts.game.alwaysLiveMatches}</span>
        <input
          type="checkbox"
          checked={state.settings.alwaysLiveMatches}
          onChange={(e) =>
            dispatch({ type: 'setAlwaysLiveMatches', value: (e.currentTarget as HTMLInputElement).checked })
          }
        />
      </label>

      <h2>{texts.save.title}</h2>
      <div class="actions">
        <button type="button" class="button" onClick={() => void handleExport()}>
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
      </div>
      <p class="muted small">
        {texts.game.seed} {state.meta.seed} · {format(texts.app.version, { version: __APP_VERSION__ })}
      </p>
    </div>
  );
}
