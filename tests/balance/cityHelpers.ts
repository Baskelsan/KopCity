// Ré-exports pour les joueurs automatiques, et l'affluence attendue au prochain match à domicile.
import balance from '../../src/data/balance.json';
import { attendanceFor } from '../../src/core/economy';
import type { GameState } from '../../src/core/state';

export { allSlots, canBuild, canExtendStadium, canUpgrade, stadiumCapacity } from '../../src/core/city';

export function attendanceForCheck(state: GameState) {
  return attendanceFor(state.city, balance.attraction.base);
}
