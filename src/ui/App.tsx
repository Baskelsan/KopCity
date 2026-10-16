import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { format, texts } from './i18n';
import { CityScreen } from './screens/CityScreen';
import { ClubScreen } from './screens/ClubScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MatchScreen } from './screens/MatchScreen';
import { InstallHelp, rememberInstallHelpDismissed, shouldOfferInstallHelp } from './InstallHelp';
import { achievementsMet } from '../core/achievements';
import { loadAchievements, unlockAchievements, type UnlockedAchievement } from '../storage/achievements';
import { achievementTitle } from './AchievementsView';
import { NewClubScreen } from './screens/NewClubScreen';
import { OffseasonScreen } from './screens/OffseasonScreen';
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
  // Création du club : au premier lancement, et à chaque nouvelle partie.
  const [creating, setCreating] = useState(false);
  const startNewGame = useCallback(() => setCreating(true), []);
  const [showInstall, setShowInstall] = useState(shouldOfferInstallHelp);
  const closeInstall = useCallback(() => {
    rememberInstallHelpDismissed();
    setShowInstall(false);
  }, []);

  // Succès : dès qu'une condition est remplie, le succès est gardé pour toujours et signalé.
  const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);
  useEffect(() => {
    void loadAchievements().then(setAchievements).catch(() => setAchievements([]));
  }, []);
  useEffect(() => {
    if (!state || creating) return;
    const met = achievementsMet(state);
    if (met.every((id) => achievements.some((a) => a.id === id))) return;
    void unlockAchievements(met, state.club.name, new Date().toISOString())
      .then(({ all, added }) => {
        setAchievements(all);
        if (added.length > 0) {
          setMessage(added.map((a) => format(texts.achievements.toast, { title: achievementTitle(a.id) })).join(' '));
        }
      })
      .catch(() => undefined);
  }, [state, creating, achievements]);

  // Temps de jeu : compté par tranches, seulement quand l'app est à l'écran.
  const playing = state !== null && !creating;
  useEffect(() => {
    if (!playing) return;
    const STEP = 30;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') dispatch({ type: 'addPlayTime', seconds: STEP });
    }, STEP * 1000);
    return () => clearInterval(timer);
  }, [playing, dispatch]);

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
            <button type="button" class="button wide" onClick={startNewGame}>
              {texts.save.newGame}
            </button>
          </div>
        )}
        {(status === 'needsClub' || creating) && (
          <NewClubScreen
            onCreate={(name, colors) => {
              replace(createGame(name, colors));
              setCreating(false);
              setTab('home');
            }}
            onCancel={creating && state && state.phase !== 'gameOver' ? () => setCreating(false) : undefined}
          />
        )}
        {!creating && state && state.phase === 'gameOver' && <GameOverScreen state={state} onNewGame={startNewGame} />}
        {!creating && state && tab === 'home' && state.phase === 'offseason' && <OffseasonScreen state={state} dispatch={dispatch} notify={setMessage} />}
        {!creating && state && tab === 'home' && state.phase === 'season' && (
          <HomeScreen state={state} dispatch={dispatch} onOpenMatch={() => setTab('matches')} />
        )}
        {!creating && state && state.phase !== 'gameOver' && tab === 'city' && <CityScreen state={state} dispatch={dispatch} />}
        {!creating && state && state.phase !== 'gameOver' && tab === 'squad' && <SquadScreen state={state} dispatch={dispatch} />}
        {!creating && state && state.phase !== 'gameOver' && tab === 'matches' && <MatchScreen state={state} dispatch={dispatch} liveFromStart={liveFromStart} />}
        {!creating && state && state.phase !== 'gameOver' && tab === 'club' && (
          <ClubScreen
            state={state}
            dispatch={dispatch}
            replace={replace}
            notify={setMessage}
            onNewGame={startNewGame}
            onShowInstall={() => setShowInstall(true)}
            achievements={achievements}
          />
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
      {showInstall && <InstallHelp onClose={closeInstall} />}
      <UpdateBanner />
    </div>
  );
}
