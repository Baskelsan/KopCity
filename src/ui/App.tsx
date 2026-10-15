import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { texts } from './i18n';
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

  // Un match à enjeu lancé par « Avancer » se déroule depuis la 1re minute sur l'onglet Matchs ;
  // un match repris après fermeture s'affiche là où il en était. À la fin du match, retour à l'accueil.
  const matchInProgress = state?.currentMatch != null;
  const loaded = state !== null;
  const [liveFromStart, setLiveFromStart] = useState(false);
  const wasInProgress = useRef<boolean | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const before = wasInProgress.current;
    wasInProgress.current = matchInProgress;
    if (matchInProgress && before !== true) {
      setLiveFromStart(before === false);
      setTab('matches');
    }
    if (!matchInProgress && before === true) setTab('home');
  }, [matchInProgress, loaded]);

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
        {state && tab === 'home' && <HomeScreen state={state} dispatch={dispatch} onOpenMatch={() => setTab('matches')} />}
        {state && tab === 'city' && <CityScreen state={state} dispatch={dispatch} />}
        {state && tab === 'squad' && <SquadScreen state={state} dispatch={dispatch} />}
        {state && tab === 'matches' && <MatchScreen state={state} dispatch={dispatch} liveFromStart={liveFromStart} />}
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
