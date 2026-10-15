import { attendanceFor, matchAttraction, netResult, totalExpenses, totalIncome } from '../core/economy';
import { myDivision, opponentOf } from '../core/league';
import { MY_TEAM_ID, type FinanceReport, type GameState } from '../core/state';
import { formatEuros, formatInteger } from './formatters';
import { format, texts } from './i18n';
import { teamName } from './logText';
import { Sheet } from './Sheet';

const F = texts.finance;
const decimals = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function signed(value: number): string {
  return value > 0 ? `+${formatEuros(value)}` : formatEuros(value);
}

/** Une dépense s'affiche en négatif, sauf zéro (pas de « -0 € »). */
const minus = (value: number) => formatEuros(value === 0 ? 0 : -value);

function Report({ title, report, homeMatches }: { title: string; report: FinanceReport; homeMatches?: number }) {
  const income: [string, number][] = [
    [F.tickets, report.income.tickets],
    [F.bars, report.income.bars],
    [F.shop, report.income.shop],
    [F.sponsors, report.income.sponsors],
  ];
  const expenses: [string, number][] = [
    [F.wages, report.expenses.wages],
    [F.upkeep, report.expenses.upkeep],
    [F.running, report.expenses.running],
    [F.fines, report.expenses.fines],
  ];
  const net = netResult(report);
  return (
    <section class="report">
      <h3>{title}</h3>
      <dl class="ledger">
        <div class="ledger-head">
          <dt>{F.income}</dt>
          <dd>{formatEuros(totalIncome(report))}</dd>
        </div>
        {income.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatEuros(value)}</dd>
          </div>
        ))}
        <div class="ledger-head">
          <dt>{F.expenses}</dt>
          <dd>{minus(totalExpenses(report))}</dd>
        </div>
        {expenses.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{minus(value)}</dd>
          </div>
        ))}
        <div class={`ledger-total ${net >= 0 ? 'positive' : 'negative'}`}>
          <dt>{F.net}</dt>
          <dd>{signed(net)}</dd>
        </div>
      </dl>
      {report.attendance !== null &&
        (homeMatches === undefined ? (
          <p class="muted">{format(F.attendance, { attendance: formatInteger(report.attendance) })}</p>
        ) : (
          homeMatches > 0 && (
            <p class="muted">
              {format(F.seasonAttendance, {
                total: formatInteger(report.attendance),
                matches: homeMatches,
                average: formatInteger(Math.round(report.attendance / homeMatches)),
              })}
            </p>
          )
        ))}
    </section>
  );
}

/** Pourquoi l'affluence du prochain match à domicile vaut ce qu'elle vaut. */
function NextHomeAttendance({ state }: { state: GameState }) {
  const division = myDivision(state.league);
  const next = division.fixtures
    .filter((f) => f.week >= state.time.week && f.home === MY_TEAM_ID && !f.result)
    .sort((a, b) => a.week - b.week)[0];
  if (!next) return null;
  const detail = attendanceFor(state.city, matchAttraction(state, opponentOf(next)));
  const values = {
    capacity: formatInteger(detail.capacity),
    accessCap: formatInteger(detail.accessCap),
    demand: formatInteger(detail.demand),
  };
  return (
    <section class="report">
      <h3>{F.nextHomeTitle}</h3>
      <p>
        {format(texts.home.fixture, { week: next.week, opponent: teamName(state, next.away) })} ·{' '}
        {format(F.attendance, { attendance: formatInteger(detail.attendance) })}
      </p>
      <p class="muted">
        {format(F.limitedBy, {
          limit: format(F.limits[detail.limitedBy], {
            value: values[detail.limitedBy],
            supporters: formatInteger(detail.supporters),
            attraction: decimals.format(detail.attraction),
          }),
        })}
      </p>
    </section>
  );
}

export function FinanceSheet({ state, onClose }: { state: GameState; onClose: () => void }) {
  return (
    <Sheet title={F.title} onClose={onClose}>
      {state.finance.lastWeek && <Report title={F.week} report={state.finance.lastWeek} />}
      <Report
        title={F.season}
        report={state.finance.season}
        homeMatches={myDivision(state.league).fixtures.filter((f) => f.home === MY_TEAM_ID && f.result).length}
      />
      <NextHomeAttendance state={state} />
      <button type="button" class="button secondary wide" onClick={onClose}>
        {F.close}
      </button>
    </Sheet>
  );
}
