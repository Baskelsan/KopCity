/** Raisons pour lesquelles une sauvegarde est refusée. Les textes associés sont dans texts.fr.json (saveErrors). */
export type SaveErrorCode = 'invalidJson' | 'invalidFormat' | 'futureVersion' | 'missingMigration';

export class SaveError extends Error {
  constructor(
    readonly code: SaveErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'SaveError';
  }
}
