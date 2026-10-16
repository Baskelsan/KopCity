// Type de l'état de jeu : un seul objet JSON sérialisable (voir docs/CADRAGE.md, « Modèle de données »).
// Toute modification de structure incrémente SCHEMA_VERSION et ajoute une migration dans src/storage/migrations.

import type { MatchState } from './matchTypes';

export const SCHEMA_VERSION = 12;

export type Position = 'GAR' | 'DEF' | 'MIL' | 'ATT';
export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '5-3-2';
export type PlayStyle = 'offensive' | 'balanced' | 'defensive';
export type DivisionId = 'D3' | 'D2' | 'D1';
export type DistrictId = 'stade' | 'faubourg' | 'gare' | 'nouveau';
export type BuildingType = 'bar' | 'shop' | 'housing' | 'transport' | 'academy';
/** Le stade n'occupe pas d'emplacement mais se construit aussi en chantier. */
export type ConstructionType = BuildingType | 'stadium';

export interface Meta {
  /** Dates ISO, fournies par la couche de sauvegarde (le cœur ne lit jamais l'heure). */
  createdAt: string;
  lastSavedAt: string;
  /** Graine de départ de la partie, gardée pour le débogage. */
  seed: number;
  /** État courant du générateur aléatoire (entier 32 bits non signé). */
  rngState: number;
  /** Dernier export de la sauvegarde, pour le rappel (ajouté en v8). */
  lastExport: { season: number; week: number } | null;
  /** Temps passé à jouer, en secondes, fourni par l'interface (ajouté en v8). */
  playTime: { total: number; season: number; lastSeason: number };
}

export interface Settings {
  alwaysLiveMatches: boolean;
}

export interface GameTime {
  season: number;
  week: number;
}

export interface Club {
  name: string;
  colors: [string, string];
  treasury: number;
  weeksInRed: number;
  /** Multiplicateur des sponsors de la saison (1,1 si tous les objectifs de la saison précédente sont atteints) (v7). */
  sponsorMultiplier: number;
  /** Prix du billet, en multiple du prix de base de la division (0,5 à 2) (ajouté en v10). */
  ticketPriceFactor: number;
}

export interface PlayerStats {
  /** Pour un gardien : « arrêts ». */
  att: number;
  def: number;
  pas: number;
  phy: number;
}

export interface Player {
  id: string;
  name: string;
  pos: Position;
  age: number;
  stats: PlayerStats;
  potential: number;
  potentialStarsShown: number;
  morale: number;
  monthlySalary: number;
  contractYears: number;
  injuryWeeks: number;
  /** Formé au centre de formation du club (ajouté en v5). */
  homegrown: boolean;
  /** Statistiques de la saison en cours et de toute la carrière au club (ajouté en v9). */
  seasonStats: PlayerSeasonStats;
  careerStats: PlayerSeasonStats;
}

export interface PlayerSeasonStats {
  apps: number;
  goals: number;
  assists: number;
  /** Somme des notes de match (sur 10) ; la moyenne = ratingTotal / apps. */
  ratingTotal: number;
}

export interface Squad {
  formation: Formation;
  style: PlayStyle;
  autoLineup: boolean;
  lineup: string[];
  players: Player[];
}

export interface Building {
  type: BuildingType;
  level: number;
}

export interface Slot {
  id: string;
  building: Building | null;
}

export interface District {
  id: DistrictId;
  unlocked: boolean;
  slots: Slot[];
}

export interface Construction {
  /** null pour le stade, qui n'a pas d'emplacement. */
  slotId: string | null;
  type: ConstructionType;
  level: number;
  weeksLeft: number;
}

export interface City {
  stadiumLevel: number;
  population: number;
  supporterShare: number;
  residentSatisfaction: number;
  districts: District[];
  constructions: Construction[];
}

export interface TeamStrength {
  att: number;
  mid: number;
  def: number;
  /** Gardien (ajouté en v2). */
  gk: number;
}

export interface Team {
  id: string;
  name: string;
  /** Niveau caché (même échelle que les notes des joueurs), d'où se déduit la force (ajouté en v5). */
  level: number;
  strength: TeamStrength;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  /** Graine du match, pour pouvoir le rejouer. */
  seed: number;
}

export interface Fixture {
  week: number;
  home: string;
  away: string;
  result: MatchResult | null;
  live: boolean;
}

export interface TableRow {
  team: string;
  played: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface Division {
  id: DivisionId;
  teams: Team[];
  fixtures: Fixture[];
  table: TableRow[];
}

/** Identifiant du club du joueur dans les calendriers et classements. */
export const MY_TEAM_ID = 'me';

export interface League {
  myDivision: DivisionId;
  divisions: Division[];
  /** Adversaire du derby dans la division du club (ajouté en v4). */
  rivalId: string | null;
}

export interface MarketOffer {
  player: Player;
  price: number;
}

export interface Market {
  offers: MarketOffer[];
  /** Mercato ouvert (intersaison ou fenêtre d'hiver) (ajouté en v5). */
  open: boolean;
  /** Dernière saison où la fenêtre d'hiver a été ouverte. */
  lastWinterSeason: number;
}

export type Movement = 'promoted' | 'relegated' | 'stayed';

/** Bilan de la saison qui vient de se terminer. */
export interface SeasonSummary {
  season: number;
  division: DivisionId;
  rank: number;
  bonus: number;
  movement: Movement;
  /** Résultat financier de la saison (recettes − dépenses, hors prime). */
  net: number;
}

/** Ce qui se décide entre deux saisons (ajouté en v5). */
export interface Offseason {
  summary: SeasonSummary;
  /** Jeunes sortis du centre de formation, à signer ou non. */
  prospects: Player[];
  /** Noms des joueurs partis à la retraite. */
  retired: string[];
  /** Évolution des notes pendant l'intersaison (ajouté en v6). */
  ratingChanges: RatingChange[];
  /** Objectifs de la saison écoulée et leurs primes (ajouté en v7). */
  objectiveResults: ObjectiveResult[];
  /** Records battus pendant la saison écoulée (ajouté en v7). */
  recordsBeaten: RecordKey[];
  /** Joueurs qui demandent une augmentation après une bonne saison (ajouté en v10). */
  raiseRequests: RaiseRequest[];
}

export interface RaiseRequest {
  playerId: string;
  /** Salaire mensuel demandé. */
  salary: number;
}

export interface RatingChange {
  playerId: string;
  name: string;
  age: number;
  before: number;
  after: number;
}

export type Phase = 'season' | 'offseason' | 'gameOver';

export interface PendingEvent {
  eventId: string;
  /** Joueur concerné (star blessée, offre pour un joueur), null sinon. */
  targetPlayerId: string | null;
  /** Montant proposé pour le joueur visé (offre), 0 sinon. */
  offerPrice: number;
  /** Jeune prodige proposé, null sinon. */
  prodigy: Player | null;
}

export interface EventRecord {
  eventId: string;
  choiceId: string;
  season: number;
  week: number;
}

export interface Events {
  pending: PendingEvent | null;
  history: EventRecord[];
  /** Dernière semaine où le tirage d'événement a eu lieu (un seul tirage par semaine). */
  lastRoll: { season: number; week: number } | null;
}

/** Effets temporaires laissés par les événements (ajouté en v7). */
export type ActiveEffect =
  | { kind: 'homeStrength'; factor: number; matchesLeft: number }
  | { kind: 'attendance'; factor: number; matchesLeft: number }
  | { kind: 'sponsorBonus'; perWeek: number; weeksLeft: number }
  | { kind: 'commitTransport'; season: number; transportsAtStart: number; repay: number; satisfaction: number };

export type ObjectiveCategory = 'sport' | 'finance' | 'city';

export interface Objective {
  id: string;
  category: ObjectiveCategory;
  type: string;
  value: number;
  achieved: boolean;
}

export interface ObjectiveResult {
  id: string;
  achieved: boolean;
  reward: number;
}

export interface Title {
  season: number;
  division: DivisionId;
}

export interface ScorerRecord {
  playerId: string;
  name: string;
  goals: number;
}

export interface SeasonRecord {
  season: number;
  division: DivisionId;
  rank: number;
  /** Trésorerie en fin de saison (prime comprise) et affluence moyenne à domicile ; null si inconnues (ajouté en v12). */
  treasury: number | null;
  averageAttendance: number | null;
}

/** Bilan face à un adversaire, championnat et coupe (ajouté en v12). */
export interface HeadToHead {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface Records {
  titles: Title[];
  promotions: number;
  bestAttendance: number;
  bestTreasury: number;
  /** Buts marqués pour le club en championnat, par joueur. */
  scorers: ScorerRecord[];
  history: SeasonRecord[];
  /** Saisons où le club a gagné la coupe (ajouté en v11). */
  cups: number[];
  /** Parcours en coupe : dernier tour joué par le club chaque saison (ajouté en v11). */
  cupRuns: CupRun[];
  /** Bilan face à chaque adversaire (ajouté en v12). */
  headToHead: Record<string, HeadToHead>;
  /** Fois où le club est sorti du rouge après au moins 3 semaines (ajouté en v12). */
  redRecoveries: number;
  /** Victoires en coupe contre un club d'au moins deux divisions au-dessus (ajouté en v12). */
  giantKillings: number;
  /** Records au début de la saison, pour signaler ceux battus pendant la saison. */
  seasonStart: { bestAttendance: number; bestTreasury: number; topScorer: ScorerRecord | null };
}

export interface CupRun {
  season: number;
  /** Dernier tour joué (1 = 1er tour… 5 = finale). */
  round: number;
  won: boolean;
}

export interface CupTie {
  home: string;
  away: string;
  result: {
    homeGoals: number;
    awayGoals: number;
    /** Tirs au but en cas d'égalité. */
    penalties: { home: number; away: number } | null;
    winner: string;
    seed: number;
  } | null;
  live: boolean;
}

export interface CupRound {
  /** 1 = 1er tour, 2 = huitièmes… 5 = finale. */
  round: number;
  week: number;
  ties: CupTie[];
  played: boolean;
}

export interface Cup {
  season: number;
  /** Les deux clubs qui entrent au 2e tour. */
  byes: string[];
  rounds: CupRound[];
  winner: string | null;
}

export type RecordKey = 'bestAttendance' | 'bestTreasury' | 'topScorer';

/** Entrée du journal : une clé de texte (texts.fr.json) et ses paramètres, jamais un texte en dur. */
export interface LogEntry {
  season: number;
  week: number;
  key: string;
  params?: Record<string, string | number>;
}

/** Comptes d'une semaine (ou cumul de la saison), en euros. */
export interface FinanceReport {
  /** `other` : transferts et événements en cours de saison (ajouté en v7). */
  income: { tickets: number; bars: number; shop: number; sponsors: number; other: number; cup: number };
  expenses: { wages: number; upkeep: number; running: number; fines: number; other: number };
  /** Affluence du match à domicile (cumul pour la saison), null sans match à domicile. */
  attendance: number | null;
}

export interface Finance {
  lastWeek: FinanceReport | null;
  season: FinanceReport;
}

export type AlertKey =
  | 'keyMatch'
  | 'constructionDelivered'
  | 'districtUnlocked'
  | 'starterInjured'
  | 'treasuryNegative'
  | 'lowSatisfaction'
  | 'seasonOver'
  | 'winterMarket'
  | 'event'
  | 'bankruptcy'
  | 'eventOutcome'
  | 'cupResult';

/** Raison pour laquelle « Avancer » s'est arrêté. Texte dans texts.fr.json (alerts). */
export interface Alert {
  key: AlertKey;
  params?: Record<string, string | number>;
}

export interface GameState {
  schemaVersion: number;
  /** Saison en cours ou intersaison (ajouté en v5). */
  phase: Phase;
  meta: Meta;
  settings: Settings;
  time: GameTime;
  club: Club;
  squad: Squad;
  city: City;
  league: League;
  market: Market;
  events: Events;
  objectives: Objective[];
  records: Records;
  log: LogEntry[];
  /** Match en cours, sauvegardé pour reprendre là où on en était (ajouté en v2). */
  currentMatch: MatchState | null;
  /** Comptes de la semaine et de la saison (ajouté en v4). */
  finance: Finance;
  /** Raisons du dernier arrêt, affichées jusqu'au prochain « Avancer » (ajouté en v4). */
  alerts: Alert[];
  /** Décisions de l'intersaison, null pendant la saison (ajouté en v5). */
  offseason: Offseason | null;
  /** Effets temporaires des événements (ajouté en v7). */
  effects: ActiveEffect[];
  /** Faillite : moment où la partie s'est terminée, null tant qu'elle continue (ajouté en v7). */
  gameOver: { season: number; week: number } | null;
  /** Coupe nationale de la saison (null avant la première, après une migration) (ajouté en v11). */
  cup: Cup | null;
}
