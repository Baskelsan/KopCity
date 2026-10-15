import { format, texts } from './i18n';
import { UpdateBanner } from './UpdateBanner';

export function App() {
  return (
    <div class="app">
      <main class="home">
        <div class="crest" aria-hidden="true">{texts.app.monogram}</div>
        <h1>{texts.app.name}</h1>
        <p class="tagline">{texts.app.tagline}</p>
        <p>{texts.home.comingSoon}</p>
      </main>
      <footer class="footer">
        <span class="version">{format(texts.app.version, { version: __APP_VERSION__ })}</span>
      </footer>
      <UpdateBanner />
    </div>
  );
}
