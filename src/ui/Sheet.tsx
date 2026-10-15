import type { ComponentChildren } from 'preact';

interface SheetProps {
  title: string;
  children: ComponentChildren;
  /** Absent : le panneau ne se ferme qu'en faisant un choix. */
  onClose?: () => void;
}

/** Panneau qui monte du bas de l'écran, à portée du pouce. */
export function Sheet({ title, children, onClose }: SheetProps) {
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <section class="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
