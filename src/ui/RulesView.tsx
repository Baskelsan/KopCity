import { texts } from './i18n';

const R = texts.rules;

/** Les règles du jeu en bref, en rubriques dépliables. */
export function RulesView() {
  return (
    <section class="card rules">
      <h2>{R.title}</h2>
      <p class="muted">{R.intro}</p>
      {R.sections.map((section) => (
        <details key={section.title}>
          <summary>{section.title}</summary>
          <p>{section.body}</p>
        </details>
      ))}
    </section>
  );
}
