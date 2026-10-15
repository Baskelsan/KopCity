import type { GameState } from '../core/state';

/** Initiales du club pour l'écusson : « FC Kop City » donne « KC » (les sigles de 2 lettres ou moins sont sautés). */
export function clubInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => w.length > 2);
  const source = meaningful.length > 0 ? meaningful : words;
  return source
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** Écusson aux couleurs du club. */
export function ClubCrest({ state }: { state: GameState }) {
  const [primary, secondary] = state.club.colors;
  return (
    <div class="crest small-crest" style={{ background: primary, color: secondary }} aria-hidden="true">
      {clubInitials(state.club.name)}
    </div>
  );
}
