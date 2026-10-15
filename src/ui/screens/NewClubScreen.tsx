import { useState } from 'preact/hooks';
import clubColors from '../../data/clubColors.json';
import { clubInitials } from '../clubCrest';
import { format, texts } from '../i18n';

const N = texts.newClub;
const MAX_NAME = 24;

interface NewClubScreenProps {
  onCreate: (name: string, colors: [string, string]) => void;
  /** Absent au premier lancement : il faut créer un club pour jouer. */
  onCancel?: () => void;
}

function Swatches({ value, onPick, label }: { value: string; onPick: (color: string) => void; label: string }) {
  return (
    <div class="field">
      <span>{label}</span>
      <div class="swatches">
        {clubColors.map((color, i) => (
          <button
            key={color}
            type="button"
            class={`swatch${value === color ? ' active' : ''}`}
            style={{ background: color }}
            aria-label={format(N.colorLabel, { index: i + 1 })}
            aria-pressed={value === color}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
    </div>
  );
}

/** Création du club : nom et deux couleurs. */
export function NewClubScreen({ onCreate, onCancel }: NewClubScreenProps) {
  const [name, setName] = useState(texts.defaults.clubName);
  const [primary, setPrimary] = useState(clubColors[0]!);
  const [secondary, setSecondary] = useState(clubColors[clubColors.length - 1]!);
  const trimmed = name.trim();

  return (
    <div class="screen home-screen new-club">
      <h1>{N.title}</h1>
      <p class="muted">{N.intro}</p>
      <div class="crest big-crest" style={{ background: primary, color: secondary }} aria-hidden="true">
        {clubInitials(trimmed || texts.defaults.clubName)}
      </div>
      <label class="field">
        <span>{N.name}</span>
        <input
          type="text"
          class="text-input"
          value={name}
          maxLength={MAX_NAME}
          autocomplete="off"
          onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      {!trimmed && <p class="refusal">{N.nameRequired}</p>}
      <Swatches label={N.primary} value={primary} onPick={setPrimary} />
      <Swatches label={N.secondary} value={secondary} onPick={setSecondary} />
      <div class="advance-bar new-club-actions">
        {onCancel && (
          <button type="button" class="button secondary" onClick={onCancel}>
            {N.cancel}
          </button>
        )}
        <button
          type="button"
          class="button big"
          disabled={!trimmed}
          onClick={() => onCreate(trimmed, [primary, secondary])}
        >
          {N.start}
        </button>
      </div>
    </div>
  );
}
