// v11 → v12 : historique détaillé (trésorerie, affluence moyenne), face-à-face, compteurs pour les succès.
import type { Migration } from './index';

type Obj = Record<string, unknown>;

export const v11ToV12: Migration = (save) => {
  const records = save.records as Obj;
  return {
    ...save,
    records: {
      ...records,
      history: (records.history as Obj[]).map((h) => ({ treasury: null, averageAttendance: null, ...h })),
      headToHead: {},
      redRecoveries: 0,
      giantKillings: 0,
    },
  };
};
