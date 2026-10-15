import { overall } from '../core/players';
import type { Player } from '../core/state';
import { format, texts } from './i18n';

/** « J. Diallo (ATT, note 14) » : pour savoir de qui on parle dans un événement ou une alerte. */
export function playerLabel(player: Player | undefined): string {
  if (!player) return '';
  return format(texts.playerLabel, { name: player.name, pos: texts.positions[player.pos], rating: overall(player) });
}
