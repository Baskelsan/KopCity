import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { texts } from './i18n';
import { describeLog } from './logText';
import { CityScreen } from './screens/CityScreen';
import { ClubScreen } from './screens/ClubScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MatchScreen } from './screens/MatchScreen';
import { SquadScreen } from './screens/SquadScreen';
import { UpdateBanner } from './UpdateBanner';
import { createGame, useGame } from './useGame';

type Tab = 'home' | 'squad' | 'city' | 'matches' | 'club';
const TABS: Tab[] = ['home', 'squad', 'city', 'matches', 'club'];

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [message, setMessage] = useState<string | null>(null);
  const onSaveError = useCallback(() => setMessage(texts.save.saveFailed), []);
  const { state, status, dispatch, replace } = useGame(onSaveError);

  // Un match en cours (repris après fermeture) ramène sur l'onglet Matchs.
  const matchInProgress = state?.currentMatch != null;
  useEffect(() => {
    if (matchInProgress) setTab('matches');
  }, [matchInProgress]);

  // Les nouvelles entrées du journal (chantier livré, quartier débloqué) s'affichent en message.
  const logLength = state?.log.length;
  const previousLogLength = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (logLength === undefined) return;
    const previous = previousLogLength.current;
    previousLogLength.current = logLength;
    if (previous === undefined || logLength <= previous || !state) return;
    setMessage(state.log.slice(previous).map(describeLog).join(' '));
  }, [logLength]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div class="app">
      <main class="content">
        {status === 'loading' && <p class="muted center">{texts.app.loading}</p>}
        {status === 'loadFailed' && (
          <div class="screen">
            <p>{texts.save.loadFailed}</p>
            <button type="button" class="button wide" onClick={() => replace(createGame())}>
              {texts.save.newGame}
            </button>
          </div>
        )}
        {state && tab === 'home' && <HomeScreen state={state} dispatch={dispatch} />}
        {state && tab === 'city' && <CityScreen state={state} dispatch={dispatch} />}
        {state && tab === 'squad' && <SquadScreen state={state} dispatch={dispatch} />}
        {state && tab === 'matches' && <MatchScreen state={state} dispatch={dispatch} />}
        {state && tab === 'club' && (
          <ClubScreen state={state} dispatch={dispatch} replace={replace} notify={setMessage} />
        )}
      </main>

      {message && (
        <p class="toast" role="status">
          {message}
        </p>
      )}

      <nav class="tabbar">
        {TABS.map((t) => (
          <button key={t} type="button" class={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {texts.tabs[t]}
          </button>
        ))}
      </nav>
      <UpdateBanner />
    </div>
  );
}
