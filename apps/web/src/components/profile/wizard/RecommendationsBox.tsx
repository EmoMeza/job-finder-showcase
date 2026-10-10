import type { ProfileSection } from '@job-finder/shared';
import { Lightbulb } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { WizardValues } from './form';

/** Sugerencias de la IA para la sección del paso actual. "Listo" las quita. */
export function RecommendationsBox({ section }: { section: ProfileSection }) {
  const { control } = useFormContext<WizardValues>();
  const { fields, remove } = useFieldArray({ control, name: 'recommendations' });
  const items = fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.section === section);

  if (items.length === 0) return null;

  return (
    <aside
      aria-label="Sugerencias de la IA"
      className="space-y-2 rounded-xl border border-primary/30 bg-secondary p-4"
    >
      <p className="flex items-center gap-2 font-semibold text-petroleo-oscuro">
        <Lightbulb className="size-4" />
        {items.length === 1 ? 'Sugerencia' : 'Sugerencias'} a partir de tu CV
      </p>
      <ul className="space-y-2">
        {items.map(({ field, index }) => (
          <li key={field.id} className="flex items-start justify-between gap-3">
            <span>{field.text}</span>
            <button
              type="button"
              onClick={() => remove(index)}
              className="shrink-0 text-sm font-semibold text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary"
            >
              Listo
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
