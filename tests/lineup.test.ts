import { describe, expect, it } from 'vitest';
import { autoLineup, benchOf, effectiveLineup, formationSlots, FORMATIONS, swapInLineup } from '../src/core/lineup';
import { generateSquad, lineRating } from '../src/core/players';
import { seedToState } from '../src/core/rng';

const squad = generateSquad(seedToState(21), 10).value;
const byId = new Map(squad.map((p) => [p.id, p]));

describe('formations', () => {
  it('ont toutes 11 places, dont un gardien en premier', () => {
    for (const f of FORMATIONS) {
      const slots = formationSlots(f);
      expect(slots).toHaveLength(11);
      expect(slots[0]).toBe('GAR');
      expect(slots.filter((s) => s === 'GAR')).toHaveLength(1);
    }
  });

  it('respectent le nombre de joueurs par ligne', () => {
    const count = (f: (typeof FORMATIONS)[number], line: string) => formationSlots(f).filter((s) => s === line).length;
    expect([count('4-3-3', 'DEF'), count('4-3-3', 'MIL'), count('4-3-3', 'ATT')]).toEqual([4, 3, 3]);
    expect([count('4-2-3-1', 'DEF'), count('4-2-3-1', 'MIL'), count('4-2-3-1', 'ATT')]).toEqual([4, 5, 1]);
    expect([count('5-3-2', 'DEF'), count('5-3-2', 'MIL'), count('5-3-2', 'ATT')]).toEqual([5, 3, 2]);
  });
});

describe('composition automatique', () => {
  it('aligne 11 joueurs différents, chacun à son poste quand c’est possible', () => {
    for (const f of FORMATIONS) {
      const lineup = autoLineup(squad, f);
      expect(new Set(lineup).size).toBe(11);
      formationSlots(f).forEach((line, i) => {
        const p = byId.get(lineup[i]!)!;
        // 4-2-3-1 et 3-5-2 demandent 5 milieux : il y en a 6, tout le monde est à son poste.
        expect(p.pos).toBe(line);
      });
    }
  });

  it('prend le meilleur gardien', () => {
    const keepers = squad.filter((p) => p.pos === 'GAR').sort((a, b) => lineRating(b, 'GAR') - lineRating(a, 'GAR'));
    expect(autoLineup(squad, '4-4-2')[0]).toBe(keepers[0]!.id);
  });

  it('écarte les blessés et complète avec d’autres postes si besoin', () => {
    const injured = squad.map((p) => (p.pos === 'ATT' ? { ...p, injuryWeeks: 2 } : p));
    const lineup = autoLineup(injured, '4-3-3');
    expect(lineup.every((id) => id !== '')).toBe(true);
    for (const id of lineup) expect(injured.find((p) => p.id === id)!.injuryWeeks).toBe(0);
  });

  it('laisse des places vides s’il manque des joueurs', () => {
    const lineup = autoLineup(squad.slice(0, 8), '4-4-2');
    expect(lineup.filter((id) => id === '')).toHaveLength(3);
  });
});

describe('composition modifiée à la main', () => {
  const lineup = autoLineup(squad, '4-4-2');
  const bench = benchOf(squad, lineup);

  it('le banc contient les 7 autres joueurs', () => {
    expect(bench).toHaveLength(7);
  });

  it('un remplaçant prend la place d’un titulaire', () => {
    const next = swapInLineup(lineup, lineup[3]!, bench[0]!);
    expect(next[3]).toBe(bench[0]);
    expect(next).not.toContain(lineup[3]);
  });

  it('deux titulaires échangent leurs places', () => {
    const next = swapInLineup(lineup, lineup[1]!, lineup[9]!);
    expect(next[1]).toBe(lineup[9]);
    expect(next[9]).toBe(lineup[1]);
  });

  it('au coup d’envoi, un titulaire blessé est remplacé par le meilleur remplaçant', () => {
    const hurt = squad.map((p) => (p.id === lineup[0] ? { ...p, injuryWeeks: 1 } : p));
    const fielded = effectiveLineup(hurt, '4-4-2', lineup);
    expect(fielded[0]).not.toBe(lineup[0]);
    expect(byId.get(fielded[0]!)!.pos).toBe('GAR');
    expect(fielded.slice(1)).toEqual(lineup.slice(1));
  });
});
