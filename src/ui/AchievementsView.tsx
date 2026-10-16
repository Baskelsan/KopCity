import { ACHIEVEMENTS } from '../core/achievements';
import type { UnlockedAchievement } from '../storage/achievements';
import { format, texts } from './i18n';

const A = texts.achievements;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function achievementTitle(id: string): string {
  return A.items[id as keyof typeof A.items]?.title ?? id;
}

/** Les succès, débloqués ou non, gardés d'une partie à l'autre. */
export function AchievementsView({ unlocked }: { unlocked: UnlockedAchievement[] }) {
  const byId = new Map(unlocked.map((u) => [u.id, u]));
  return (
    <section class="card achievements">
      <h2>{A.title}</h2>
      <p class="muted">{format(A.count, { count: byId.size, total: ACHIEVEMENTS.length })}</p>
      <ul class="plain">
        {ACHIEVEMENTS.map((a) => {
          const item = A.items[a.id as keyof typeof A.items];
          const got = byId.get(a.id);
          return (
            <li key={a.id} class={got ? 'unlocked' : 'locked'}>
              <span class="badge" aria-hidden="true">
                {got ? '🏅' : '🔒'}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small class="muted">{item.description}</small>
                {got && (
                  <small class="muted">
                    {format(A.unlockedOn, { date: dateFormat.format(new Date(got.unlockedAt)), club: got.club })}
                  </small>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
