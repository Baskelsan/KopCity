import texts from '../data/texts.fr.json';

export { texts };

/** Remplace les {variables} d'un texte : format('Version {version}', { version: '1.0' }). */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
