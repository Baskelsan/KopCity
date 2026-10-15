import { describe, expect, it } from 'vitest';
import { format, texts } from '../src/ui/i18n';

function collectStrings(node: unknown, path = ''): [string, unknown][] {
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      collectStrings(value, path ? `${path}.${key}` : key),
    );
  }
  return [[path, node]];
}

describe('format', () => {
  it('remplace les variables connues', () => {
    expect(format('Version {version}', { version: '0.1.0' })).toBe('Version 0.1.0');
    expect(format('{a} et {b}', { a: 1, b: 2 })).toBe('1 et 2');
  });

  it('laisse intactes les variables inconnues', () => {
    expect(format('Bonjour {nom}', {})).toBe('Bonjour {nom}');
  });
});

describe('texts.fr.json', () => {
  it('ne contient que des textes non vides', () => {
    for (const [path, value] of collectStrings(texts)) {
      expect(typeof value, path).toBe('string');
      expect((value as string).trim(), path).not.toBe('');
    }
  });

  it('contient les textes du bandeau de mise à jour', () => {
    expect(texts.pwa.updateAvailable).toBeTruthy();
    expect(texts.pwa.reload).toBeTruthy();
  });
});
