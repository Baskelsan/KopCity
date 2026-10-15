import { describe, expect, it } from 'vitest';
import { nextChance, nextFloat, nextInt, pick, seedToState, shuffle } from '../src/core/rng';

function sequence(seed: number, count: number): number[] {
  let state = seedToState(seed);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const draw = nextFloat(state);
    values.push(draw.value);
    state = draw.rngState;
  }
  return values;
}

describe('générateur à graine', () => {
  it('donne la même suite pour la même graine', () => {
    expect(sequence(42, 50)).toEqual(sequence(42, 50));
  });

  it('donne des suites différentes pour des graines différentes', () => {
    expect(sequence(42, 10)).not.toEqual(sequence(43, 10));
  });

  it('ne modifie rien : même état en entrée, même tirage en sortie', () => {
    const state = seedToState(7);
    expect(nextFloat(state)).toEqual(nextFloat(state));
  });

  it('reste dans [0, 1) et répartit les valeurs', () => {
    const values = sequence(123, 10000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('tire des entiers dans les bornes, bornes comprises', () => {
    let state = seedToState(99);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const draw = nextInt(state, 8, 15);
      seen.add(draw.value);
      state = draw.rngState;
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('refuse des bornes invalides', () => {
    expect(() => nextInt(1, 5, 2)).toThrow(RangeError);
    expect(() => nextInt(1, 0.5, 2)).toThrow(RangeError);
  });

  it('respecte une probabilité', () => {
    let state = seedToState(5);
    let hits = 0;
    for (let i = 0; i < 10000; i++) {
      const draw = nextChance(state, 1 / 3);
      if (draw.value) hits++;
      state = draw.rngState;
    }
    expect(hits / 10000).toBeGreaterThan(0.31);
    expect(hits / 10000).toBeLessThan(0.36);
    expect(nextChance(state, 0).value).toBe(false);
    expect(nextChance(state, 1).value).toBe(true);
  });

  it('choisit dans une liste et refuse une liste vide', () => {
    const items = ['a', 'b', 'c'];
    expect(items).toContain(pick(seedToState(3), items).value);
    expect(() => pick(1, [])).toThrow(RangeError);
  });

  it('mélange sans perdre ni modifier la liste d\'origine', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const draw = shuffle(seedToState(11), items);
    expect([...draw.value].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(shuffle(seedToState(11), items)).toEqual(draw);
  });
});
