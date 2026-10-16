/// <reference types="node" />
// Simulation d'équilibrage : 3 stratégies × 100 parties de 5 saisons. Lancer avec `npm run simulate`.
// Écrit le rapport dans docs/EQUILIBRAGE.md.
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { playGame, STRATEGIES, type GameResult, type StrategyName } from './bots';

const GAMES = Number(process.env.SIM_GAMES ?? 100);
const SEASONS = 5;
const DIV = { D3: 1, D2: 2, D1: 3 } as const;
const NAMES: Record<StrategyName, string> = {
  stadium: 'Tout sur le stade',
  players: 'Tout sur les joueurs',
  balanced: 'Équilibrée',
  max: 'À fond',
};

// Estimation de durée d'une saison (secondes), à confirmer en jouant pour de vrai.
const SECONDS = { stop: 15, liveMatch: 75, event: 20, offseason: 240, management: 300 };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};
const pct = (x: number) => `${Math.round(x * 100)} %`;
const eur = (x: number) => `${Math.round(x / 1000).toLocaleString('fr-FR')} k€`;

function summarize(results: GameResult[]) {
  const seasons = results.flatMap((r) => r.seasons);
  const minutes = seasons.map(
    (s) =>
      (s.stops * SECONDS.stop + s.liveMatches * SECONDS.liveMatch + s.events * SECONDS.event + SECONDS.offseason + SECONDS.management) /
      60,
  );
  return {
    bankrupt: mean(results.map((r) => (r.bankrupt ? 1 : 0))),
    bestDivision: mean(results.map((r) => DIV[r.bestDivision as keyof typeof DIV])),
    reachedD2: mean(results.map((r) => (DIV[r.bestDivision as keyof typeof DIV] >= 2 ? 1 : 0))),
    reachedD1: mean(results.map((r) => (DIV[r.bestDivision as keyof typeof DIV] >= 3 ? 1 : 0))),
    titles: mean(results.map((r) => r.titles)),
    treasury: median(results.map((r) => r.treasury)),
    satisfaction: mean(results.map((r) => r.satisfaction)),
    attendance: mean(results.map((r) => r.bestAttendance)),
    capacity: mean(results.map((r) => r.capacity)),
    population: mean(results.map((r) => r.population)),
    stops: mean(seasons.map((s) => s.stops)),
    live: mean(seasons.map((s) => s.liveMatches)),
    events: mean(seasons.map((s) => s.events)),
    minutes: mean(minutes),
    reasons: Object.fromEntries(
      [...new Set(seasons.flatMap((s) => Object.keys(s.reasons)))].map((k) => [k, mean(seasons.map((s) => s.reasons[k] ?? 0))]),
    ),
  };
}

it(
  'simulation',
  () => {
    const table: Record<StrategyName, ReturnType<typeof summarize>> = {} as never;
    for (const name of ['balanced', 'stadium', 'players'] as StrategyName[]) {
      const results = Array.from({ length: GAMES }, (_, i) => playGame(i + 1, STRATEGIES[name], SEASONS));
      table[name] = summarize(results);
    }
    const rows: [string, (s: ReturnType<typeof summarize>) => string][] = [
      ['Faillites', (s) => pct(s.bankrupt)],
      ['Meilleure division (moyenne, 1 = D3, 3 = Élite)', (s) => s.bestDivision.toFixed(2)],
      ['Parties qui atteignent la Division 2', (s) => pct(s.reachedD2)],
      ["Parties qui atteignent l'Élite", (s) => pct(s.reachedD1)],
      ['Titres par partie', (s) => s.titles.toFixed(2)],
      ['Trésorerie finale (médiane)', (s) => eur(s.treasury)],
      ['Satisfaction finale (moyenne)', (s) => s.satisfaction.toFixed(0)],
      ['Meilleure affluence (moyenne)', (s) => Math.round(s.attendance).toLocaleString('fr-FR')],
      ['Capacité finale (moyenne)', (s) => Math.round(s.capacity).toLocaleString('fr-FR')],
      ['Population finale (moyenne)', (s) => Math.round(s.population).toLocaleString('fr-FR')],
      ['Arrêts par saison', (s) => s.stops.toFixed(1)],
      ['Matchs en direct par saison', (s) => s.live.toFixed(1)],
      ['Événements par saison', (s) => s.events.toFixed(1)],
      ['Durée estimée d’une saison', (s) => `${Math.round(s.minutes)} min`],
    ];
    const order: StrategyName[] = ['balanced', 'stadium', 'players'];
    const lines = [
      '# Équilibrage — rapport de simulation',
      '',
      `Généré par \`npm run simulate\` : ${GAMES} parties de ${SEASONS} saisons par stratégie, mêmes graines pour les trois.`,
      '',
      `| Mesure | ${order.map((n) => NAMES[n]).join(' | ')} |`,
      `| --- | ${order.map(() => '---').join(' | ')} |`,
      ...rows.map(([label, f]) => `| ${label} | ${order.map((n) => f(table[n])).join(' | ')} |`),
      '',
      `Durée estimée : ${SECONDS.stop} s par arrêt, ${SECONDS.liveMatch} s par match en direct, ${SECONDS.event} s par événement,`,
      `${SECONDS.offseason / 60} min d'intersaison et ${SECONDS.management / 60} min de gestion (effectif, ville) par saison.`,
      '',
      '## Arrêts par saison, selon leur raison (stratégie équilibrée)',
      '',
      '| Raison | Arrêts par saison |',
      '| --- | --- |',
      ...Object.entries(table.balanced.reasons)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `| ${k} | ${v.toFixed(1)} |`),
      '',
    ];
    // Fin de partie : la stratégie « à fond » sur 15 saisons.
    const LONG_GAMES = Number(process.env.SIM_LONG_GAMES ?? 30);
    const LONG_SEASONS = 15;
    const long = Array.from({ length: LONG_GAMES }, (_, i) => playGame(i + 1, STRATEGIES.max, LONG_SEASONS));
    lines.push(
      '## Fin de partie : stratégie « à fond » sur 15 saisons',
      '',
      `${LONG_GAMES} parties : centre de formation au maximum le plus tôt possible, toute la ville améliorée, tous les jeunes signés, les meilleurs joueurs achetés, toutes les augmentations acceptées.`,
      '',
      '| Saison | Note moyenne du onze | Trésorerie (médiane) | En Élite | Titre d\'Élite (parmi les clubs en Élite) | Faillites cumulées |',
      '| --- | --- | --- | --- | --- | --- |',
    );
    for (let season = 1; season <= LONG_SEASONS; season++) {
      const rows = long.map((r) => r.perSeason[season - 1]).filter((x) => x !== undefined);
      const inElite = rows.filter((r) => r.division === 'D1');
      const bankrupt = long.filter((r) => r.bankrupt && r.seasonsPlayed <= season).length;
      lines.push(
        `| ${season} | ${mean(rows.map((r) => r.level)).toFixed(1)} | ${eur(median(rows.map((r) => r.treasury)))} | ${pct(inElite.length / LONG_GAMES)} | ${inElite.length ? pct(inElite.filter((r) => r.champion).length / inElite.length) : '–'} | ${pct(bankrupt / LONG_GAMES)} |`,
      );
    }
    lines.push('');
    writeFileSync(new URL('../../docs/EQUILIBRAGE.md', import.meta.url), lines.join('\n'));
    console.log(lines.join('\n'));
  },
  1_800_000,
);
