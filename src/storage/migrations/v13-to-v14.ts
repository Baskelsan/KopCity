// v13 → v14 : staff du club et ligne « Staff » dans les comptes.
import type { Migration } from './index';

type Obj = Record<string, unknown>;
type Report = { income: Obj; expenses: Obj; attendance: unknown };

const withStaff = (r: Report): Report => ({ ...r, expenses: { ...r.expenses, staff: 0 } });

export const v13ToV14: Migration = (save) => {
  const finance = save.finance as { lastWeek: Report | null; season: Report };
  return {
    ...save,
    staff: { physio: false, scout: false, analyst: false },
    finance: { lastWeek: finance.lastWeek ? withStaff(finance.lastWeek) : null, season: withStaff(finance.season) },
  };
};
