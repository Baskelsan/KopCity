import { stillInCup } from '../core/cup';
import { MY_TEAM_ID, type CupTie, type GameState } from '../core/state';
import { cupRoundName } from './cupText';
import { format, texts } from './i18n';
import { teamName } from './logText';

const C = texts.cup;

function TieLine({ tie, state }: { tie: CupTie; state: GameState }) {
  const mine = tie.home === MY_TEAM_ID || tie.away === MY_TEAM_ID;
  const r = tie.result;
  const winnerClass = (team: string) => (r && r.winner === team ? 'winner' : '');
  return (
    <li class={`cup-tie${mine ? ' mine' : ''}`}>
      <span class={winnerClass(tie.home)}>{teamName(state, tie.home)}</span>
      <strong>
        {r ? `${r.homeGoals}-${r.awayGoals}` : C.pending}
        {r?.penalties && <small class="muted"> {format(C.penaltiesShort, r.penalties)}</small>}
      </strong>
      <span class={winnerClass(tie.away)}>{teamName(state, tie.away)}</span>
    </li>
  );
}

/** Le tableau de la coupe : chaque tour, le match du club mis en avant. */
export function CupView({ state }: { state: GameState }) {
  const cup = state.cup;
  if (!cup) return <p class="muted center">{C.notThisSeason}</p>;
  const out = !stillInCup(state) && !cup.winner && cup.rounds.some((r) => r.played);
  return (
    <div class="cup">
      <h2>🏆 {C.title}</h2>
      {cup.winner && <p class="positive">{format(C.champion, { team: teamName(state, cup.winner) })}</p>}
      {cup.byes.includes(MY_TEAM_ID) && <p class="muted">{C.bye}</p>}
      {out && <p class="muted">{C.out}</p>}
      {[...cup.rounds].reverse().map((round) => {
        const mine = round.ties.filter((t) => t.home === MY_TEAM_ID || t.away === MY_TEAM_ID);
        const others = round.ties.filter((t) => t.home !== MY_TEAM_ID && t.away !== MY_TEAM_ID);
        return (
          <section key={round.round} class="card cup-round">
            <h3>
              {cupRoundName(round.round)} <small class="muted">· {format(C.week, { week: round.week })}</small>
            </h3>
            <ul class="plain">
              {[...mine, ...others].map((tie, i) => (
                <TieLine key={i} tie={tie} state={state} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
