import { describe, expect, it } from 'vitest';
import { exportReminderDue } from '../src/core/exportReminder';
import { applyAction, newGame } from '../src/core/game';
import { endSeason, startSeason } from '../src/core/offseason';
import { weeklyWages } from '../src/core/players';
import { generateSquad } from '../src/core/players';
import { seedToState } from '../src/core/rng';
import type { GameState } from '../src/core/state';
import { clubInitials } from '../src/ui/clubCrest';

const fresh = () => newGame({ seed: 5, now: 'x', clubName: 'Racing Club de Bréville', clubColors: ['#1d4ed8', '#ffffff'] });
const at = (state: GameState, season: number, week: number): GameState => ({ ...state, time: { season, week } });

describe('création du club', () => {
  it('garde le nom et les couleurs choisis', () => {
    const s = fresh();
    expect(s.club.name).toBe('Racing Club de Bréville');
    expect(s.club.colors).toEqual(['#1d4ed8', '#ffffff']);
  });

  it('les initiales de l’écusson sautent les sigles courts', () => {
    expect(clubInitials('FC Kop City')).toBe('KC');
    expect(clubInitials('Racing Club de Bréville')).toBe('RC');
    expect(clubInitials('AS')).toBe('A');
  });
});

describe('rappel d’export', () => {
  it('n’apparaît qu’à l’intersaison, jusqu’à ce qu’on exporte', () => {
    const s = fresh();
    expect(exportReminderDue(at(s, 1, 12))).toBe(false);
    const off = endSeason(at(s, 1, 19));
    expect(exportReminderDue(off)).toBe(true);
    const exported = applyAction(off, { type: 'markExported' });
    expect(exportReminderDue(exported)).toBe(false);
  });

  it('un export pendant la saison ne dispense pas du rappel de fin de saison', () => {
    const exportedMidSeason = applyAction(at(fresh(), 1, 10), { type: 'markExported' });
    expect(exportReminderDue(endSeason(at(exportedMidSeason, 1, 19)))).toBe(true);
  });
});

describe('temps de jeu', () => {
  it('s’additionne, et la saison repart de zéro au lancement de la suivante', () => {
    let s = applyAction(fresh(), { type: 'addPlayTime', seconds: 30 });
    s = applyAction(s, { type: 'addPlayTime', seconds: 30 });
    expect(s.meta.playTime).toEqual({ total: 60, season: 60, lastSeason: 0 });
    expect(applyAction(s, { type: 'addPlayTime', seconds: -5 })).toBe(s);
    const off = endSeason({ ...s, time: { season: 1, week: 19 } });
    const next = startSeason(off);
    if (next.phase === 'season') expect(next.meta.playTime).toEqual({ total: 60, season: 0, lastSeason: 60 });
  });
});

describe('équilibrage', () => {
  it('la masse salariale de départ reste autour de 40 000 € par semaine', () => {
    let total = 0;
    for (let seed = 0; seed < 200; seed++) total += weeklyWages(generateSquad(seedToState(seed), 10).value);
    const average = total / 200;
    expect(average).toBeGreaterThan(36000);
    expect(average).toBeLessThan(44000);
  });

  it('les contrats de départ durent de 2 à 4 saisons', () => {
    for (const p of fresh().squad.players) {
      expect(p.contractYears).toBeGreaterThanOrEqual(2);
      expect(p.contractYears).toBeLessThanOrEqual(4);
    }
  });
});
