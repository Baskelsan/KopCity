// Échange de fichiers avec l'appareil : partage iOS ou téléchargement pour l'export, sélecteur pour l'import.
import type { GameState } from '../core/state';
import { exportFileName, parseSave, serializeSave } from './serialize';

/** Propose le fichier de sauvegarde via la feuille de partage, sinon le télécharge. */
export async function exportSaveFile(state: GameState, nowIso: string): Promise<void> {
  const name = exportFileName(nowIso);
  const file = new File([serializeSave(state)], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      // Le joueur a fermé la feuille de partage : rien à faire.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      throw error;
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lit et valide un fichier de sauvegarde choisi par le joueur. Lève une SaveError s'il est refusé. */
export async function readSaveFile(file: File): Promise<GameState> {
  return parseSave(await file.text());
}
