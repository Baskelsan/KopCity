import { SCHEMA_VERSION, type GameState } from '../core/state';
import { SaveError } from './errors';

type Obj = Record<string, unknown>;

const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isArray = Array.isArray;

/** Champs attendus, par bloc de l'état. Contrôle de structure, pas de cohérence de jeu. */
const shape: Record<string, Record<string, (v: unknown) => boolean>> = {
  meta: {
    createdAt: isString,
    lastSavedAt: isString,
    seed: isNumber,
    rngState: isNumber,
    lastExport: (v) => v === null || isObject(v),
    playTime: isObject,
  },
  settings: { alwaysLiveMatches: isBoolean },
  time: { season: isNumber, week: isNumber },
  club: { name: isString, colors: isArray, treasury: isNumber, weeksInRed: isNumber, sponsorMultiplier: isNumber, ticketPriceFactor: isNumber },
  squad: { formation: isString, style: isString, autoLineup: isBoolean, lineup: isArray, players: isArray },
  city: {
    stadiumLevel: isNumber,
    population: isNumber,
    supporterShare: isNumber,
    residentSatisfaction: isNumber,
    districts: isArray,
    constructions: isArray,
  },
  league: { myDivision: isString, divisions: isArray, rivalId: (v) => v === null || isString(v) },
  finance: { lastWeek: (v) => v === null || isObject(v), season: isObject },
  market: { offers: isArray, open: isBoolean, lastWinterSeason: isNumber },
  events: { pending: (v) => v === null || isObject(v), history: isArray, lastRoll: (v) => v === null || isObject(v) },
  records: {
    titles: isArray,
    promotions: isNumber,
    bestAttendance: isNumber,
    bestTreasury: isNumber,
    scorers: isArray,
    history: isArray,
    seasonStart: isObject,
  },
};

/** Vérifie qu'un objet a la structure d'un état de jeu à la version courante. */
export function assertGameState(save: unknown): GameState {
  if (!isObject(save)) throw new SaveError('invalidFormat', 'pas un objet');
  if (save.schemaVersion !== SCHEMA_VERSION) {
    throw new SaveError('invalidFormat', `schemaVersion ${String(save.schemaVersion)}`);
  }
  for (const [block, fields] of Object.entries(shape)) {
    const value = save[block];
    if (!isObject(value)) throw new SaveError('invalidFormat', `${block} manquant`);
    for (const [field, check] of Object.entries(fields)) {
      if (!check(value[field])) throw new SaveError('invalidFormat', `${block}.${field} invalide`);
    }
  }
  if (!isArray(save.objectives)) throw new SaveError('invalidFormat', 'objectives invalide');
  if (!isArray(save.log)) throw new SaveError('invalidFormat', 'log invalide');
  if (!isArray(save.alerts)) throw new SaveError('invalidFormat', 'alerts invalide');
  if (save.phase !== 'season' && save.phase !== 'offseason' && save.phase !== 'gameOver') {
    throw new SaveError('invalidFormat', 'phase invalide');
  }
  if (!isArray(save.effects)) throw new SaveError('invalidFormat', 'effects invalide');
  if (save.gameOver !== null && !isObject(save.gameOver)) throw new SaveError('invalidFormat', 'gameOver invalide');
  if (save.offseason !== null && !isObject(save.offseason)) throw new SaveError('invalidFormat', 'offseason invalide');
  if (save.currentMatch !== null && !isObject(save.currentMatch)) {
    throw new SaveError('invalidFormat', 'currentMatch invalide');
  }
  return save as unknown as GameState;
}
