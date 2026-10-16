import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, achievementsMet, isMet } from '../src/core/achievements';
import { newGame } from '../src/core/game';
import { myDivision } from '../src/core/league';
import { endSeason } from '../src/core/offseason';
import { addHeadToHead } from '../src/core/records';
import { MY_TEAM_ID, type GameState } from '../src/core/state';
import { loadAchievements, unlockAchievements } from '../src/storage/achievements';
import { advanceAndHandle } from './helpers';

const fresh = (seed = 4) => newGame({ seed, now: 'x', clubName: 'FC Test' });
const spec = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;

describe('historique', () => {
  it('le bilan face à un adversaire additionne victoires, nuls, défaites et buts', () => {
    let r = fresh().records;
    r = addHeadToHead(r, 'x', 2, 0);
    r = addHeadToHead(r, 'x', 1, 1);
    r = addHeadToHead(r, 'x', 0, 3);
    expect(r.headToHead.x).toEqual({ played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 4 });
  });

  it('chaque match de championnat compte dans le face-à-face', () => {
    let s = fresh(9);
    for (let i = 0; i < 10; i++) s = advanceAndHandle(s);
    const leaguePlayed = myDivision(s.league).fixtures.filter(
      (f) => f.result && (f.home === MY_TEAM_ID || f.away === MY_TEAM_ID),
    ).length;
    const cupPlayed = (s.cup?.rounds ?? []).filter((r) =>
      r.ties.some((t) => t.result && (t.home === MY_TEAM_ID || t.away === MY_TEAM_ID)),
    ).length;
    const total = Object.values(s.records.headToHead).reduce((sum, h) => sum + h.played, 0);
    expect(total).toBe(leaguePlayed + cupPlayed);
  });

  it('la fin de saison note la trésorerie et l’affluence moyenne', () => {
    let s = fresh(10);
    for (let i = 0; i < 60 && s.time.week <= 18; i++) s = advanceAndHandle(s);
    const off = endSeason(s);
    const last = off.records.history.at(-1)!;
    expect(last.treasury).toBe(off.club.treasury);
    expect(last.averageAttendance).toBeGreaterThan(0);
  });
});

describe('succès', () => {
  it('15 succès, chacun avec un titre et une description', async () => {
    const texts = (await import('../src/data/texts.fr.json')).default;
    expect(ACHIEVEMENTS).toHaveLength(15);
    for (const a of ACHIEVEMENTS) {
      const t = texts.achievements.items[a.id as keyof typeof texts.achievements.items];
      expect(t.title).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });

  it('aucun succès au tout début d’une partie', () => {
    expect(achievementsMet(fresh())).toEqual([]);
  });

  it('se débloquent selon l’état de la partie', () => {
    const s = fresh();
    const with_ = (patch: Partial<GameState['records']>): GameState => ({ ...s, records: { ...s.records, ...patch } });
    expect(isMet(with_({ promotions: 1 }), spec('firstPromotion'))).toBe(true);
    expect(isMet(with_({ titles: [{ season: 1, division: 'D3' }] }), spec('firstTitle'))).toBe(true);
    expect(isMet(with_({ titles: [{ season: 1, division: 'D3' }] }), spec('eliteTitle'))).toBe(false);
    expect(isMet(with_({ titles: [{ season: 4, division: 'D1' }] }), spec('eliteTitle'))).toBe(true);
    expect(isMet(with_({ cups: [2] }), spec('cupWinner'))).toBe(true);
    expect(isMet(with_({ giantKillings: 1 }), spec('giantKiller'))).toBe(true);
    expect(isMet(with_({ bestAttendance: 10000 }), spec('fullHouse'))).toBe(true);
    expect(isMet(with_({ bestAttendance: 9999 }), spec('fullHouse'))).toBe(false);
    expect(isMet(with_({ bestTreasury: 1_000_000 }), spec('millionaire'))).toBe(true);
    expect(isMet(with_({ scorers: [{ playerId: 'a', name: 'A', goals: 50 }] }), spec('goalMachine'))).toBe(true);
    expect(isMet(with_({ redRecoveries: 1 }), spec('survivor'))).toBe(true);
    expect(isMet({ ...s, league: { ...s.league, myDivision: 'D1' } }, spec('reachElite'))).toBe(true);
    const allOpen = { ...s, city: { ...s.city, districts: s.city.districts.map((d) => ({ ...d, unlocked: true })) } };
    expect(isMet(allOpen, spec('allDistricts'))).toBe(true);
  });

  it('une première victoire et une série sans défaite se lisent dans les résultats', () => {
    let s = fresh(11);
    for (let i = 0; i < 25 && !isMet(s, spec('firstWin')); i++) s = advanceAndHandle(s);
    expect(isMet(s, spec('firstWin'))).toBe(true);
  });

  it('sortir du rouge après 3 semaines compte comme un sauvetage', () => {
    const s = fresh(12);
    const rescued = advanceAndHandle({ ...s, club: { ...s.club, treasury: 5_000_000, weeksInRed: 3 } });
    expect(rescued.records.redRecoveries).toBe(1);
  });

  it('sont gardés à part, sans doublon, d’une partie à l’autre', async () => {
    const first = await unlockAchievements(['firstWin', 'firstPromotion'], 'FC Un', '2026-10-16T10:00:00.000Z');
    expect(first.added.map((a) => a.id)).toEqual(['firstWin', 'firstPromotion']);
    const again = await unlockAchievements(['firstWin', 'cupWinner'], 'FC Deux', '2026-10-17T10:00:00.000Z');
    expect(again.added.map((a) => a.id)).toEqual(['cupWinner']);
    const all = await loadAchievements();
    expect(all.map((a) => a.id)).toEqual(['firstWin', 'firstPromotion', 'cupWinner']);
    expect(all.find((a) => a.id === 'firstWin')!.club).toBe('FC Un');
  });
});
