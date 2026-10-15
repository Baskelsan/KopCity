import { texts } from './i18n';
import { Sheet } from './Sheet';

const DISMISSED_KEY = 'kopcity:installHelpDismissed';

/** L'app tourne-t-elle depuis l'écran d'accueil (installée) ? */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** À montrer au lancement : sur iPhone, dans Safari, tant que le joueur ne l'a pas fermée. */
export function shouldOfferInstallHelp(): boolean {
  if (isStandalone() || !isIos()) return false;
  try {
    return localStorage.getItem(DISMISSED_KEY) !== '1';
  } catch {
    return true;
  }
}

export function rememberInstallHelpDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Stockage indisponible : l'aide reviendra au prochain lancement, ce n'est pas grave.
  }
}

/** iOS ne propose pas d'installer une PWA : on explique le geste dans Safari. */
export function InstallHelp({ onClose }: { onClose: () => void }) {
  const I = texts.install;
  return (
    <Sheet title={I.title} onClose={onClose}>
      <p class="muted">{I.intro}</p>
      <ol class="install-steps">
        <li>{I.step1}</li>
        <li>{I.step2}</li>
        <li>{I.step3}</li>
      </ol>
      <p class="muted small">{I.offline}</p>
      <button type="button" class="button wide" onClick={onClose}>
        {I.close}
      </button>
    </Sheet>
  );
}
