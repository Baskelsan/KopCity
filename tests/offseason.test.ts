import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { applyAction, newGame, type Action } from '../src/core/game';
import { DIVISIONS, myDivision, rankOf, standings } from '../src/core/league';
import { advanceAndHandle, finishLiveMatch, resolvePendingEvent } from './helpers';
import {
  agePlayer,
  canStartSeason,
  endSeason,
  expiringPlayers,
  generateMarket,
  generateProspects,
  renewalSalary,
  seasonBonus,
} from '../src/core/offseason';
import { overall, saleValue, transferValue } from '../src/core/players';
import { seedToState } from '../src/core/rng';
import { MY_TEAM_ID, type GameState, type Player, type TableRow } from '../src/core/state';

const SZ = balance.squadSize;
const fresh = (seed = 5) => newGame({ seed, now: 'x', clubName: 'FC Test' });
const run = (state: GameState, ...actions: Action[]) => actions.reduce(applyAction, state);

/** Joue jusqu'à l'intersaison en appuyant sur Avancer (matchs en direct avec les choix par défaut). */
function playToOffseason(start: GameState): GameState {
  let s = start;
  for (let guard = 0; guard < 200; guard++) {
    if (s.phase === 'offseason') return s;
    s = advanceAndHandle(s);
  }
  throw new Error("L'intersaison n'arrive jamais");
}

/** Décisions par défaut d'intersaison : tout prolonger 2 saisons, signer les jeunes s'il y a la place. */
function defaultOffseason(state: GameState): GameState {
  let s = state;
  for (const p of expiringPlayers(s)) s = run(s, { type: 'renewContract', playerId: p.id, years: 2 });
  for (const p of s.offseason!.prospects) s = run(s, { type: 'signProspect', playerId: p.id });
  // Si des départs ont trop réduit l'effectif, on complète avec les joueurs les moins chers du marché.
  const cheapest = [...s.market.offers].sort((a, b) => a.price - b.price);
  for (const offer of cheapest) {
    if (canStartSeason(s).ok) break;
    s = { ...s, club: { ...s.club, treasury: Math.max(s.club.treasury, offer.price) } };
    s = run(s, { type: 'buyPlayer', playerId: offer.player.id });
  }
  return run(s, { type: 'startSeason' });
}

/** Prolonge d'une saison tous les joueurs en fin de contrat. */
function defaultOffseasonRenewals(state: GameState): GameState {
  let s = state;
  for (const p of expiringPlayers(s)) s = run(s, { type: 'renewContract', playerId: p.id, years: 1 });
  return s;
}

/** Place le club au rang voulu de sa division, en fin de saison. */
function finishedAt(rank: number): GameState {
  const s = fresh();
  const division = myDivision(s.league);
  const others = division.teams.map((t) => t.id);
  const order = [...others];
  order.splice(rank - 1, 0, MY_TEAM_ID);
  const table: TableRow[] = order.map((team, i) => ({ team, played: 18, points: 50 - i * 3, goalsFor: 20, goalsAgainst: 20 }));
  return {
    ...s,
    time: { season: 1, week: balance.league.seasonWeeks + 1 },
    league: { ...s.league, divisions: s.league.divisions.map((d) => (d.id === division.id ? { ...d, table } : d)) },
  };
}

describe('championnat sur 3 divisions', () => {
  const s = fresh();

  it('compte 3 divisions de 10 équipes, le club en Division 3', () => {
    expect(s.league.divisions.map((d) => [d.id, d.table.length])).toEqual([
      ['D3', 10],
      ['D2', 10],
      ['D1', 10],
    ]);
    expect(myDivision(s.league).id).toBe('D3');
    expect(s.league.divisions.flatMap((d) => d.teams)).toHaveLength(29);
  });

  it('les 29 adversaires ont des noms et des identifiants différents', () => {
    const teams = s.league.divisions.flatMap((d) => d.teams);
    expect(new Set(teams.map((t) => t.id)).size).toBe(29);
    expect(new Set(teams.map((t) => t.name)).size).toBe(29);
  });

  it('les divisions supérieures sont plus fortes', () => {
    const avg = (id: string) => {
      const teams = s.league.divisions.find((d) => d.id === id)!.teams;
      return teams.reduce((sum, t) => sum + t.strength.mid, 0) / teams.length;
    };
    expect(avg('D2')).toBeGreaterThan(avg('D3'));
    expect(avg('D1')).toBeGreaterThan(avg('D2'));
  });

  it('chaque semaine se joue dans les 3 divisions', () => {
    let next = s;
    while (next.time.week === 1) next = advanceAndHandle(next);
    for (const d of next.league.divisions) {
      expect(d.fixtures.filter((f) => f.week === 1).every((f) => f.result !== null)).toBe(true);
    }
  });
});

describe('fin de saison', () => {
  it('prime : 100 % pour le premier, 20 % pour le dernier', () => {
    expect(seasonBonus('D3', 1, 10)).toBe(100000);
    expect(seasonBonus('D3', 10, 10)).toBe(20000);
    expect(seasonBonus('D1', 1, 10)).toBe(400000);
    expect(seasonBonus('D2', 4, 10)).toBeLessThan(seasonBonus('D2', 3, 10));
  });

  it('les 2 premiers de Division 3 montent, avec la prime', () => {
    const s = finishedAt(2);
    const after = run(s, { type: 'advance' });
    expect(after.phase).toBe('offseason');
    expect(after.league.myDivision).toBe('D2');
    expect(after.offseason!.summary).toMatchObject({ rank: 2, movement: 'promoted', division: 'D3' });
    const rewards = after.offseason!.objectiveResults.reduce((sum, r) => sum + r.reward, 0);
    expect(after.club.treasury).toBe(s.club.treasury + seasonBonus('D3', 2, 10) + rewards);
  });

  it('le 3e reste en Division 3', () => {
    const after = run(finishedAt(3), { type: 'advance' });
    expect(after.league.myDivision).toBe('D3');
    expect(after.offseason!.summary.movement).toBe('stayed');
  });

  it('les échanges entre divisions gardent 10 équipes partout', () => {
    const after = run(finishedAt(1), { type: 'advance' });
    const before = finishedAt(1);
    for (const id of DIVISIONS) {
      const d = after.league.divisions.find((x) => x.id === id)!;
      const withClub = id === after.league.myDivision;
      expect(d.teams.length + (withClub ? 1 : 0)).toBe(10);
    }
    const d2Before = before.league.divisions.find((d) => d.id === 'D2')!;
    const relegated = standings(d2Before.table).slice(-2).map((r) => r.team);
    const d3After = after.league.divisions.find((d) => d.id === 'D3')!;
    for (const id of relegated) expect(d3After.teams.map((t) => t.id)).toContain(id);
  });

  it('la montée en Division 2 débloque le quartier de la gare', () => {
    const after = run(finishedAt(1), { type: 'advance' });
    expect(after.city.districts.find((d) => d.id === 'gare')!.unlocked).toBe(true);
    expect(after.alerts.some((a) => a.key === 'districtUnlocked')).toBe(true);
  });

  it('les blessés sont guéris et le moral se rapproche de 70', () => {
    const s = finishedAt(5);
    const hurt = {
      ...s,
      squad: { ...s.squad, players: s.squad.players.map((p, i) => (i === 0 ? { ...p, injuryWeeks: 3, morale: 30 } : p)) },
    };
    const after = endSeason(hurt);
    const p = after.squad.players.find((x) => x.id === hurt.squad.players[0]!.id);
    if (p) {
      expect(p.injuryWeeks).toBe(0);
      expect(p.morale).toBe(50);
    }
  });

  it('Avancer ne fait rien pendant l’intersaison', () => {
    const after = run(finishedAt(5), { type: 'advance' });
    expect(run(after, { type: 'advance' })).toBe(after);
  });
});

describe('joueurs entre deux saisons', () => {
  const base = fresh().squad.players[3]!;
  const playerAged = (age: number, extra: Partial<Player> = {}): Player => ({ ...base, age, potential: 20, ...extra });

  it('un jeune progresse, sans dépasser son potentiel', () => {
    const young = playerAged(19, { stats: { att: 8, def: 8, pas: 8, phy: 8 } });
    const aged = agePlayer(seedToState(1), young, 0).value;
    expect(aged.age).toBe(20);
    for (const k of ['att', 'def', 'pas', 'phy'] as const) expect(aged.stats[k]).toBeGreaterThan(young.stats[k]);
    const capped = agePlayer(seedToState(1), { ...young, potential: overall(young) }, 0).value;
    expect(overall(capped)).toBeLessThanOrEqual(overall(young));
  });

  it('le centre de formation fait progresser plus vite les jeunes formés au club', () => {
    const young = playerAged(18, { homegrown: true, stats: { att: 6, def: 6, pas: 6, phy: 6 } });
    const without = agePlayer(seedToState(2), young, 0).value;
    const withAcademy = agePlayer(seedToState(2), young, 3).value;
    expect(overall(withAcademy)).toBeGreaterThan(overall(without));
  });

  it('stable entre 24 et 30 ans, déclin à partir de 31', () => {
    const mid = playerAged(26);
    expect(agePlayer(seedToState(3), mid, 0).value.stats).toEqual(mid.stats);
    const old = playerAged(32, { stats: { att: 12, def: 12, pas: 12, phy: 12 } });
    const aged = agePlayer(seedToState(3), old, 0).value;
    for (const k of ['att', 'def', 'pas', 'phy'] as const) expect(aged.stats[k]).toBeLessThan(12);
  });

  it('retraite obligatoire à 38 ans', () => {
    const s = finishedAt(5);
    const veteranId = s.squad.players[0]!.id;
    const old = { ...s, squad: { ...s.squad, players: s.squad.players.map((p) => (p.id === veteranId ? { ...p, age: 37 } : p)) } };
    const after = endSeason(old);
    expect(after.squad.players.map((p) => p.id)).not.toContain(veteranId);
    expect(after.offseason!.retired).toContain(s.squad.players[0]!.name);
  });

  it('les contrats avancent d’une saison ; à zéro, le joueur est en fin de contrat', () => {
    const s = finishedAt(5);
    const after = endSeason(s);
    for (const p of after.squad.players) {
      const before = s.squad.players.find((x) => x.id === p.id)!;
      expect(p.contractYears).toBe(Math.max(0, before.contractYears - 1));
    }
    expect(expiringPlayers(after).every((p) => p.contractYears === 0)).toBe(true);
  });
});

describe('contrats et lancement de saison', () => {
  const off = endSeason(finishedAt(5));

  it('prolonger fixe la durée et recalcule le salaire', () => {
    const p = expiringPlayers(off)[0];
    if (!p) return;
    const after = run(off, { type: 'renewContract', playerId: p.id, years: 3 });
    const renewed = after.squad.players.find((x) => x.id === p.id)!;
    expect(renewed.contractYears).toBe(3);
    expect(renewed.monthlySalary).toBe(renewalSalary(p));
    expect(expiringPlayers(after).map((x) => x.id)).not.toContain(p.id);
  });

  it('un joueur non prolongé part au lancement de la saison', () => {
    let s = off;
    // On complète l'effectif avec les jeunes pour pouvoir lancer la saison.
    for (const p of s.offseason!.prospects) s = run(s, { type: 'signProspect', playerId: p.id });
    const leaving = expiringPlayers(s).map((p) => p.id);
    if (!canStartSeason(s).ok) return;
    const started = run(s, { type: 'startSeason' });
    expect(started.phase).toBe('season');
    for (const id of leaving) expect(started.squad.players.map((p) => p.id)).not.toContain(id);
  });

  it('la nouvelle saison repart de la journée 1 avec des classements vierges', () => {
    const started = defaultOffseason(off);
    expect(started.time).toEqual({ season: 2, week: 1 });
    for (const d of started.league.divisions) {
      expect(d.table.every((r) => r.played === 0)).toBe(true);
      expect(d.fixtures.every((f) => f.result === null)).toBe(true);
    }
    expect(started.finance.lastWeek).toBeNull();
    expect(started.offseason).toBeNull();
    expect(started.market.open).toBe(false);
  });

  it('refuse de lancer la saison avec moins de 16 joueurs', () => {
    const tiny = { ...off, squad: { ...off.squad, players: off.squad.players.slice(0, SZ.min - 1).map((p) => ({ ...p, contractYears: 1 })) } };
    expect(canStartSeason(tiny)).toEqual({ ok: false, reason: 'squadTooSmall' });
    expect(run(tiny, { type: 'startSeason' })).toBe(tiny);
  });
});

describe('centre de formation', () => {
  it('sort 1 jeune au niveau 0 et 3 au niveau 3, entre 16 et 18 ans, formés au club', () => {
    expect(generateProspects(seedToState(1), 0, 20000).value).toHaveLength(1);
    const best = generateProspects(seedToState(1), 3, 20000).value;
    expect(best).toHaveLength(3);
    for (const p of best) {
      expect(p.age).toBeGreaterThanOrEqual(16);
      expect(p.age).toBeLessThanOrEqual(18);
      expect(p.homegrown).toBe(true);
    }
  });

  it('le potentiel monte avec le niveau du centre et la population', () => {
    const avg = (level: number, population: number) => {
      let total = 0;
      let count = 0;
      for (let seed = 1; seed <= 100; seed++) {
        for (const p of generateProspects(seedToState(seed), level, population).value) {
          total += p.potential;
          count++;
        }
      }
      return total / count;
    };
    expect(avg(3, 20000)).toBeGreaterThan(avg(0, 20000) + 2);
    expect(avg(0, 40000)).toBeGreaterThan(avg(0, 20000) + 1);
  });

  it('signer un jeune l’ajoute à l’effectif ; le laisser partir le retire de la liste', () => {
    const off = endSeason(finishedAt(5));
    const prospect = off.offseason!.prospects[0]!;
    const signed = run(off, { type: 'signProspect', playerId: prospect.id });
    expect(signed.squad.players.map((p) => p.id)).toContain(prospect.id);
    const declined = run(off, { type: 'declineProspect', playerId: prospect.id });
    expect(declined.offseason!.prospects).toHaveLength(off.offseason!.prospects.length - 1);
    expect(declined.squad.players).toHaveLength(off.squad.players.length);
  });
});

describe('mercato', () => {
  it('propose 6 à 8 joueurs au prix de leur valeur', () => {
    const offers = generateMarket(seedToState(4), 'D3').value;
    expect(offers.length).toBeGreaterThanOrEqual(6);
    expect(offers.length).toBeLessThanOrEqual(8);
    for (const o of offers) expect(o.price).toBe(transferValue(o.player));
  });

  it('la valeur monte avec la note et baisse avec l’âge', () => {
    const p = fresh().squad.players[10]!;
    const better = { ...p, stats: { att: p.stats.att + 4, def: p.stats.def + 4, pas: p.stats.pas + 4, phy: p.stats.phy + 4 } };
    expect(transferValue(better)).toBeGreaterThan(transferValue(p));
    expect(transferValue({ ...p, age: 20 })).toBeGreaterThan(transferValue({ ...p, age: 33 }));
    expect(saleValue(p)).toBe(Math.round(transferValue(p) * 0.8));
  });

  it('acheter paie le prix sans passer sous zéro, vendre rapporte 80 %', () => {
    const off = endSeason(finishedAt(5));
    const offer = off.market.offers[0]!;
    const rich = { ...off, club: { ...off.club, treasury: offer.price } };
    const bought = run(rich, { type: 'buyPlayer', playerId: offer.player.id });
    expect(bought.club.treasury).toBe(0);
    expect(bought.squad.players.map((p) => p.id)).toContain(offer.player.id);
    const poor = { ...off, club: { ...off.club, treasury: offer.price - 1 } };
    expect(run(poor, { type: 'buyPlayer', playerId: offer.player.id })).toBe(poor);

    // On prolonge tout le monde pour avoir assez de joueurs sous contrat avant de vendre.
    const renewed = defaultOffseasonRenewals(off);
    const sold = renewed.squad.players[5]!;
    const after = run(renewed, { type: 'sellPlayer', playerId: sold.id });
    expect(after.club.treasury).toBe(renewed.club.treasury + saleValue(sold));
    expect(after.squad.players.map((p) => p.id)).not.toContain(sold.id);
  });

  it('pas d’achat au-delà de 22 joueurs, pas de vente en dessous de 16', () => {
    const off = endSeason(finishedAt(5));
    const offer = off.market.offers[0]!;
    const filler = Array.from({ length: SZ.max }, (_, i) => ({ ...off.squad.players[0]!, id: `x${i}`, contractYears: 2 }));
    const full = { ...off, club: { ...off.club, treasury: 10_000_000 }, squad: { ...off.squad, players: filler } };
    expect(run(full, { type: 'buyPlayer', playerId: offer.player.id })).toBe(full);
    const small = { ...off, squad: { ...off.squad, players: filler.slice(0, SZ.min) } };
    expect(run(small, { type: 'sellPlayer', playerId: small.squad.players[0]!.id })).toBe(small);
  });

  it('pendant la saison, le mercato n’ouvre qu’en semaine 9 et se referme en repartant', () => {
    let s = fresh();
    expect(run(s, { type: 'sellPlayer', playerId: s.squad.players[0]!.id })).toBe(s);
    for (let guard = 0; guard < 60 && !s.market.open; guard++) {
      s = run(s, { type: 'advance' });
      if (s.market.open) break;
      if (s.events.pending) s = resolvePendingEvent(s);
      if (s.currentMatch) s = finishLiveMatch(s);
    }
    expect(s.market.open).toBe(true);
    expect(s.time.week).toBe(balance.market.winterWeek);
    expect(s.alerts).toEqual([{ key: 'winterMarket' }]);
    expect(s.market.offers.length).toBeGreaterThanOrEqual(6);
    const closed = run(s, { type: 'advance' });
    expect(closed.market.open).toBe(false);
    expect(closed.market.lastWinterSeason).toBe(1);
  });
});

describe('3 saisons enchaînées', () => {
  it('sur 30 parties : aucune erreur, des montées et des descentes', () => {
    const movements = new Set<string>();
    const divisionsReached = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      let s = fresh(seed);
      for (let season = 1; season <= 3; season++) {
        s = playToOffseason(s);
        movements.add(s.offseason!.summary.movement);
        s = defaultOffseason(s);
        expect(s.phase).toBe('season');
        expect(s.time.season).toBe(season + 1);
        divisionsReached.add(s.league.myDivision);
        // Toujours 3 divisions de 10, le club dans une seule.
        expect(s.league.divisions.filter((d) => d.table.some((r) => r.team === MY_TEAM_ID))).toHaveLength(1);
        for (const d of s.league.divisions) expect(d.table).toHaveLength(10);
        expect(rankOf(myDivision(s.league).table, MY_TEAM_ID)).toBeGreaterThan(0);
      }
    }
    expect(movements).toContain('promoted');
    expect(movements).toContain('relegated');
    expect(divisionsReached).toContain('D2');
  }, 120_000);
});

describe('retours de jeu (après M5)', () => {
  it('l’intersaison enregistre l’évolution de la note de chaque joueur', () => {
    const s = finishedAt(5);
    const off = endSeason(s);
    const changes = off.offseason!.ratingChanges;
    expect(changes).toHaveLength(off.squad.players.length);
    for (const c of changes) {
      const before = s.squad.players.find((p) => p.id === c.playerId)!;
      const after = off.squad.players.find((p) => p.id === c.playerId)!;
      expect(c.before).toBe(overall(before));
      expect(c.after).toBe(overall(after));
      expect(c.age).toBe(before.age + 1);
    }
  });

  it('un joueur en fin de contrat sort de la composition et ne peut pas être vendu', () => {
    const off = endSeason(finishedAt(5));
    const expiring = expiringPlayers(off);
    expect(expiring.length).toBeGreaterThan(0);
    for (const p of expiring) expect(off.squad.lineup).not.toContain(p.id);
    expect(run(off, { type: 'sellPlayer', playerId: expiring[0]!.id })).toBe(off);
  });

  it('prolongé, il revient dans la composition automatique s’il est parmi les meilleurs', () => {
    const off = endSeason(finishedAt(5));
    const best = [...expiringPlayers(off)].sort((a, b) => overall(b) - overall(a))[0]!;
    const renewed = run(off, { type: 'renewContract', playerId: best.id, years: 1 });
    const candidates = renewed.squad.players.filter((p) => p.contractYears > 0 && p.pos === best.pos);
    const isTop = [...candidates].sort((a, b) => overall(b) - overall(a))[0]!.id === best.id;
    if (isTop) expect(renewed.squad.lineup).toContain(best.id);
  });
});
