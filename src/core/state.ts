// Type de l'état de jeu : un seul objet JSON sérialisable (voir docs/CADRAGE.md, « Modèle de données »).
// Toute modification de structure incrémente SCHEMA_VERSION et ajoute une migration dans src/storage/migrations.

export const SCHEMA_VERSION = 1;

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
}

export interface Team {
  id: string;
  name: string;
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

export interface League {
  myDivision: DivisionId;
  divisions: Division[];
}

export interface MarketOffer {
  player: Player;
  price: number;
}

export interface Market {
  offers: MarketOffer[];
}

export interface PendingEvent {
  eventId: string;
}

export interface EventRecord {
  eventId: string;
  choice: number;
  season: number;
  week: number;
}

export interface Events {
  pending: PendingEvent | null;
  history: EventRecord[];
}

export interface Objective {
  id: string;
  achieved: boolean;
}

export interface Records {
  titles: number;
  promotions: number;
  bestAttendance: number;
  bestTreasury: number;
}

/** Entrée du journal : une clé de texte (texts.fr.json) et ses paramètres, jamais un texte en dur. */
export interface LogEntry {
  season: number;
  week: number;
  key: string;
  params?: Record<string, string | number>;
}

export interface GameState {
  schemaVersion: number;
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
}
