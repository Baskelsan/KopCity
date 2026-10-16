import { describe, expect, it } from 'vitest';
import balance from '../src/data/balance.json';
import { attendanceFor, priceDemandFactor, ticketPrice, weekFinance } from '../src/core/economy';
import { applyAction, newGame, type Action } from '../src/core/game';
import { myDivision } from '../src/core/league';
import { endSeason, generateMarket, generateProspects, renewalSalary, startSeason } from '../src/core/offseason';
import { contractSalary, overall, transferValue } from '../src/core/players';
import { seedToState } from '../src/core/rng';
import type { GameState } from '../src/core/state';
import { advanceAndHandle } from './helpers';

const fresh = (seed = 3) => newGame({ seed, now: 'x', clubName: 'FC Test' });
const run = (s: GameState, ...a: Action[]) => a.reduce(applyAction, s);

describe('prix du billet', () => {
  it('se règle par pas de 10 %, entre 50 % et 200 % du prix de base', () => {
    const s = fresh();
    expect(run(s, { type: 'setTicketPrice', factor: 1.27 }).club.ticketPriceFactor).toBe(1.3);
    expect(run(s, { type: 'setTicketPrice', factor: 5 }).club.ticketPriceFactor).toBe(2);
    expect(run(s, { type: 'setTicketPrice', factor: 0.1 }).club.ticketPriceFactor).toBe(0.5);
    expect(ticketPrice(run(s, { type: 'setTicketPrice', factor: 1.5 }))).toBe(Math.round(25 * 1.5));
  });

  it('plus le billet est cher, moins il y a de demande (élasticité 1,2)', () => {
    expect(priceDemandFactor(1)).toBe(1);
    expect(priceDemandFactor(1.5)).toBeCloseTo(Math.pow(1.5, -1.2));
    const city = fresh().city;
    expect(attendanceFor(city, 1, 1.5).demand).toBeLessThan(attendanceFor(city, 1, 1).demand);
    expect(attendanceFor(city, 1, 0.5).demand).toBeGreaterThan(attendanceFor(city, 1, 1).demand);
  });

  it('la billetterie utilise le prix choisi et l’affluence qui en découle', () => {
    const s = run(fresh(), { type: 'setTicketPrice', factor: 1.5 });
    const opponent = myDivision(s.league).teams.find((t) => t.id !== s.league.rivalId)!.id;
    const r = weekFinance(s, opponent);
    expect(r.income.tickets).toBe(r.attendance! * ticketPrice(s));
    expect(r.attendance!).toBeLessThan(weekFinance(fresh(), opponent).attendance!);
  });

  it('au-delà de +30 %, les supporters baissent à chaque match à domicile', () => {
    let a = run(fresh(7), { type: 'setTicketPrice', factor: 1.3 });
    let b = run(fresh(7), { type: 'setTicketPrice', factor: 1.4 });
    for (let i = 0; i < 6; i++) {
      a = advanceAndHandle(a);
      b = advanceAndHandle(b);
    }
    expect(b.city.supporterShare).toBeLessThan(a.city.supporterShare);
  });
});

describe('salaires', () => {
  it('un nouveau contrat coûte ×1,3 en Division 2 et ×1,7 en Élite', () => {
    const p = fresh().squad.players[3]!;
    const d3 = contractSalary(p, 'D3');
    expect(Math.abs(contractSalary(p, 'D2') - d3 * 1.3)).toBeLessThanOrEqual(100);
    expect(Math.abs(contractSalary(p, 'D1') - d3 * 1.7)).toBeLessThanOrEqual(100);
    expect(renewalSalary(p, 'D2')).toBeGreaterThan(renewalSalary(p, 'D3'));
  });

  it('les joueurs du marché sont payés au tarif de la division', () => {
    for (const o of generateMarket(seedToState(2), 'D1').value) {
      expect(o.player.monthlySalary).toBe(contractSalary(o.player, 'D1'));
    }
  });

  const withGoodSeason = (): GameState => {
    const s = fresh();
    const players = s.squad.players.map((p, i) =>
      i === 0 ? { ...p, seasonStats: { apps: 12, goals: 6, assists: 2, ratingTotal: 12 * 7.4 } } : p,
    );
    return { ...s, squad: { ...s.squad, players }, time: { season: 1, week: 19 } };
  };

  it('après une bonne saison (note ≥ 7 sur 10 matchs), un joueur demande au moins +20 % et son salaire juste', () => {
    const start = withGoodSeason();
    const off = endSeason(start);
    const star = start.squad.players[0]!;
    const aged = off.squad.players.find((p) => p.id === star.id)!;
    const request = off.offseason!.raiseRequests.find((r) => r.playerId === star.id);
    expect(request?.salary).toBe(
      Math.max(contractSalary(aged, off.league.myDivision), Math.round((star.monthlySalary * 1.2) / 100) * 100),
    );
  });

  it('un joueur sous-payé (moins de 75 % de son salaire juste) réclame son salaire juste', () => {
    const s = fresh();
    const cheap = { ...s.squad.players[2]!, monthlySalary: 1000 };
    const start = { ...s, time: { season: 1, week: 19 }, squad: { ...s.squad, players: s.squad.players.map((p, i) => (i === 2 ? cheap : p)) } };
    const off = endSeason(start);
    const aged = off.squad.players.find((p) => p.id === cheap.id)!;
    const request = off.offseason!.raiseRequests.find((r) => r.playerId === cheap.id);
    expect(request?.salary).toBe(contractSalary(aged, off.league.myDivision));
  });

  it('au 2e refus, le joueur part au lancement de la saison, vendu à sa valeur', () => {
    const off = endSeason(withGoodSeason());
    const request = off.offseason!.raiseRequests[0]!;
    const once = { ...off, squad: { ...off.squad, players: off.squad.players.map((p) => (p.id === request.playerId ? { ...p, refusedRaises: 1 } : p)) } };
    const refused = run(once, { type: 'answerRaise', playerId: request.playerId, accept: false });
    expect(refused.squad.players.find((p) => p.id === request.playerId)!.refusedRaises).toBe(2);
    const player = refused.squad.players.find((p) => p.id === request.playerId)!;
    const next = startSeason(refused);
    if (next.phase !== 'season') return;
    expect(next.squad.players.map((p) => p.id)).not.toContain(request.playerId);
    expect(next.alerts.some((a) => a.key === 'playerLeft')).toBe(true);
    expect(next.club.treasury).toBe(refused.club.treasury + transferValue(player));
  });

  it('accepter remet le compteur de refus à zéro', () => {
    const off = endSeason(withGoodSeason());
    const request = off.offseason!.raiseRequests[0]!;
    const once = { ...off, squad: { ...off.squad, players: off.squad.players.map((p) => (p.id === request.playerId ? { ...p, refusedRaises: 1 } : p)) } };
    const accepted = run(once, { type: 'answerRaise', playerId: request.playerId, accept: true });
    expect(accepted.squad.players.find((p) => p.id === request.playerId)!.refusedRaises).toBe(0);
  });

  it('accepter paie le nouveau salaire, refuser coûte 20 de moral', () => {
    const off = endSeason(withGoodSeason());
    const request = off.offseason!.raiseRequests[0]!;
    const accepted = run(off, { type: 'answerRaise', playerId: request.playerId, accept: true });
    expect(accepted.squad.players.find((p) => p.id === request.playerId)!.monthlySalary).toBe(request.salary);
    expect(accepted.offseason!.raiseRequests.map((r) => r.playerId)).not.toContain(request.playerId);
    const refused = run(off, { type: 'answerRaise', playerId: request.playerId, accept: false });
    const before = off.squad.players.find((p) => p.id === request.playerId)!;
    expect(refused.squad.players.find((p) => p.id === request.playerId)!.morale).toBe(
      before.morale + balance.raises.refusedMorale,
    );
  });

  it('sans réponse, la demande est refusée au lancement de la saison', () => {
    const off = endSeason(withGoodSeason());
    const id = off.offseason!.raiseRequests[0]!.playerId;
    const before = off.squad.players.find((p) => p.id === id)!;
    const next = startSeason(off);
    if (next.phase !== 'season') return;
    const after = next.squad.players.find((p) => p.id === id)!;
    expect(after.monthlySalary).toBe(before.monthlySalary);
    expect(after.morale).toBe(Math.max(0, before.morale + balance.raises.refusedMorale));
  });
});

describe('centre de formation', () => {
  it('1, 2, 3 puis 4 jeunes selon le niveau, avec une meilleure note de départ', () => {
    const avg = (level: number) => {
      let total = 0;
      let count = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const prospects = generateProspects(seedToState(seed), level, 20000).value;
        expect(prospects).toHaveLength(level + 1);
        for (const p of prospects) {
          total += overall(p);
          count++;
        }
      }
      return total / count;
    };
    expect(avg(3)).toBeGreaterThan(avg(0) + 2);
  });
});
