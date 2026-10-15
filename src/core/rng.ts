// Générateur aléatoire à graine (mulberry32), entièrement pur.
// Chaque tirage prend l'état du générateur et renvoie la valeur tirée avec le nouvel état.

export interface Draw<T> {
  value: T;
  rngState: number;
}

/** Transforme une graine quelconque en état initial du générateur (entier 32 bits non signé). */
export function seedToState(seed: number): number {
  return seed >>> 0;
}

/** Flottant dans [0, 1). */
export function nextFloat(rngState: number): Draw<number> {
  const next = (rngState + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rngState: next };
}

/** Entier dans [min, max], bornes comprises. */
export function nextInt(rngState: number, min: number, max: number): Draw<number> {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`Bornes invalides : [${min}, ${max}]`);
  }
  const draw = nextFloat(rngState);
  return { value: min + Math.floor(draw.value * (max - min + 1)), rngState: draw.rngState };
}

/** Vrai avec la probabilité donnée (entre 0 et 1). */
export function nextChance(rngState: number, probability: number): Draw<boolean> {
  const draw = nextFloat(rngState);
  return { value: draw.value < probability, rngState: draw.rngState };
}

/** Un élément au hasard dans une liste non vide. */
export function pick<T>(rngState: number, items: readonly T[]): Draw<T> {
  if (items.length === 0) throw new RangeError('Liste vide');
  const draw = nextInt(rngState, 0, items.length - 1);
  return { value: items[draw.value] as T, rngState: draw.rngState };
}

/** Copie mélangée de la liste (Fisher-Yates). */
export function shuffle<T>(rngState: number, items: readonly T[]): Draw<T[]> {
  const result = [...items];
  let state = rngState;
  for (let i = result.length - 1; i > 0; i--) {
    const draw = nextInt(state, 0, i);
    state = draw.rngState;
    [result[i], result[draw.value]] = [result[draw.value] as T, result[i] as T];
  }
  return { value: result, rngState: state };
}
