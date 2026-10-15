import { useRegisterSW } from 'virtual:pwa-register/preact';
import { texts } from './i18n';

/**
 * Bandeau de mise à jour du service worker.
 * On ne recharge jamais de force : c'est le joueur qui choisit quand relancer.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (needRefresh) {
    return (
      <div class="banner" role="status">
        <span>{texts.pwa.updateAvailable}</span>
        <div class="banner-actions">
          <button type="button" class="button secondary" onClick={() => setNeedRefresh(false)}>
            {texts.pwa.later}
          </button>
          <button type="button" class="button" onClick={() => void updateServiceWorker()}>
            {texts.pwa.reload}
          </button>
        </div>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div class="banner" role="status">
        <span>{texts.pwa.offlineReady}</span>
        <div class="banner-actions">
          <button type="button" class="button" onClick={() => setOfflineReady(false)}>
            {texts.pwa.close}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
