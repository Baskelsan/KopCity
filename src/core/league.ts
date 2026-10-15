// Championnat de la division du club : équipes, calendrier aller-retour, résultats et classement.
import balance from '../data/balance.json';
import { divisionLevel } from './players';
import { nextInt, shuffle, type Draw } from './rng';
import { MY_TEAM_ID, type Division, type DivisionId, type Fixture, type League, type TableRow, type Team } from './state';
import { generateOpponent } from './strength';

const L = balance.league;

/**
 * Calendrier aller-retour par la méthode du cercle : chaque équipe rencontre les autres
 * une fois à domicile et une fois à l'extérieur (journées 1 à n−1 puis matchs retour).
 */
export function roundRobin(teamIds: readonly string[]): Fixture[] {
  const ids = [...teamIds];
  if (ids.length % 2 === 1) throw new Error("Nombre d'équipes impair");
  const rounds = ids.length - 1;
  const half = ids.length / 2;
  const fixtures: Fixture[] = [];
  let rotation = ids.slice(1);
  for (let round = 0; round < rounds; round++) {
    const circle = [ids[0]!, ...rotation];
    for (let i = 0; i < half; i++) {
      const a = circle[i]!;
      const b = circle[circle.length - 1 - i]!;
      // On alterne domicile et extérieur pour que personne n'enchaîne trop de matchs au même endroit.
      const swap = i === 0 ? round % 2 === 1 : i % 2 === 1;
      const [home, away] = swap ? [b, a] : [a, b];
      fixtures.push({ week: round + 1, home, away, result: null, live: false });
    }
    rotation = [rotation[rotation.length - 1]!, ...rotation.slice(0, -1)];
  }
  const returnLegs = fixtures.map((f) => ({ ...f, week: f.week + rounds, home: f.away, away: f.home }));
  return [...fixtures, ...returnLegs];
}

export function emptyTable(teamIds: readonly string[]): TableRow[] {
  return teamIds.map((team) => ({ team, played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 }));
}

/** Génère une division : 9 adversaires au niveau de la division, un calendrier et un classement vierge. */
export function generateDivision(rngState: number, id: DivisionId): Draw<{ division: Division; rivalId: string }> {
  let rng = rngState;
  // Chaque club de la division vient d'une ville différente.
  const teams: Team[] = [];
  const towns: string[] = [];
  for (let i = 1; teams.length < L.teamsPerDivision - 1; i++) {
    const draw = generateOpponent(rng, divisionLevel(id), `${id.toLowerCase()}-t${i}`, towns);
    rng = draw.rngState;
    const { town, ...team } = draw.value;
    towns.push(town);
    teams.push(team);
  }
  const order = shuffle(rng, [MY_TEAM_ID, ...teams.map((t) => t.id)]);
  rng = order.rngState;
  const rival = nextInt(rng, 0, teams.length - 1);
  rng = rival.rngState;
  const ids = [MY_TEAM_ID, ...teams.map((t) => t.id)];
  return {
    value: {
      division: { id, teams, fixtures: roundRobin(order.value), table: emptyTable(ids) },
      rivalId: teams[rival.value]!.id,
    },
    rngState: rng,
  };
}

export function newLeague(rngState: number, division: DivisionId): Draw<League> {
  const draw = generateDivision(rngState, division);
  return {
    value: { myDivision: division, divisions: [draw.value.division], rivalId: draw.value.rivalId },
    rngState: draw.rngState,
  };
}

export function myDivision(league: League): Division {
  const division = league.divisions.find((d) => d.id === league.myDivision);
  if (!division) throw new Error('Division du club introuvable');
  return division;
}

/** Classement trié : points, puis différence de buts, puis buts marqués, puis identifiant. */
export function standings(table: readonly TableRow[]): TableRow[] {
  return [...table].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      a.team.localeCompare(b.team),
  );
}

/** Rang (1 = premier) d'une équipe. */
export function rankOf(table: readonly TableRow[], teamId: string): number {
  return standings(table).findIndex((row) => row.team === teamId) + 1;
}

/** Ajoute un résultat au classement. */
export function recordResult(table: readonly TableRow[], home: string, away: string, homeGoals: number, awayGoals: number): TableRow[] {
  const points = (scored: number, conceded: number) =>
    scored > conceded ? L.pointsWin : scored === conceded ? L.pointsDraw : 0;
  return table.map((row) => {
    if (row.team === home) {
      return {
        ...row,
        played: row.played + 1,
        points: row.points + points(homeGoals, awayGoals),
        goalsFor: row.goalsFor + homeGoals,
        goalsAgainst: row.goalsAgainst + awayGoals,
      };
    }
    if (row.team === away) {
      return {
        ...row,
        played: row.played + 1,
        points: row.points + points(awayGoals, homeGoals),
        goalsFor: row.goalsFor + awayGoals,
        goalsAgainst: row.goalsAgainst + homeGoals,
      };
    }
    return row;
  });
}

export function myFixture(division: Division, week: number): Fixture | undefined {
  return division.fixtures.find((f) => f.week === week && (f.home === MY_TEAM_ID || f.away === MY_TEAM_ID));
}

export function opponentOf(fixture: Fixture): string {
  return fixture.home === MY_TEAM_ID ? fixture.away : fixture.home;
}

/** Résultats du club, du plus ancien au plus récent : 'W', 'D' ou 'L'. */
export function myForm(division: Division): ('W' | 'D' | 'L')[] {
  return division.fixtures
    .filter((f) => f.result && (f.home === MY_TEAM_ID || f.away === MY_TEAM_ID))
    .sort((a, b) => a.week - b.week)
    .map((f) => {
      const r = f.result!;
      const mine = f.home === MY_TEAM_ID ? r.homeGoals : r.awayGoals;
      const theirs = f.home === MY_TEAM_ID ? r.awayGoals : r.homeGoals;
      return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
    });
}
