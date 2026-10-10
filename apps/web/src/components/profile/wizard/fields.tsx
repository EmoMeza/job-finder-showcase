import type { ReactNode } from 'react';
import { useState } from 'react';
import { get, useFormContext, useFormState, useWatch, type FieldPath } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { usePrefilled, type WizardValues } from './form';

/**
 * Etiqueta + control + error o ayuda. Con `name`, muestra el error de ese campo y lo marca con
 * destacador si lo completó la IA y aún no se revisa.
 */
export function Field(props: {
  label: string;
  htmlFor: string;
  name?: FieldPath<WizardValues>;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  const { control } = useFormContext<WizardValues>();
  const prefilled = usePrefilled();
  const value: unknown = useWatch({ control, name: props.name ?? 'data.fullName' });
  const { errors } = useFormState({ control, name: props.name });
  const error = props.name ? (get(errors, props.name)?.message as string | undefined) : undefined;
  const hasValue = Array.isArray(value) ? value.length > 0 : value !== null && value !== '';

  return (
    <div
      className={cn(
        'space-y-1.5',
        props.name && prefilled && hasValue && 'ai-prefilled',
        props.className,
      )}
    >
      <Label htmlFor={props.htmlFor} className="font-semibold">
        {props.label}
      </Label>
      {props.children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        props.hint && <p className="text-sm text-muted-foreground">{props.hint}</p>
      )}
    </div>
  );
}

/** Para campos opcionales: un texto vacío se guarda como `null`. */
export const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export const toNumberOrNull = (value: unknown) =>
  value === '' || value === null || value === undefined ? null : Number(value);

/** Mismo aspecto que `Input`, para los selects nativos. */
export const SELECT_CLASS =
  'h-9 w-full rounded-lg border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25';

const splitBy = (pattern: RegExp) => (text: string) =>
  text
    .split(pattern)
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Edita una lista de textos como texto libre: mantiene lo que se escribe (saltos de línea, comas)
 * y entrega la lista ya limpia.
 */
function useListText(value: string[], separator: string, toItems: (text: string) => string[]) {
  const [text, setText] = useState(value.join(separator));
  return { text, update: (next: string) => (setText(next), toItems(next)) };
}

export function LinesTextarea(props: {
  id: string;
  value: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  rows?: number;
}) {
  const { text, update } = useListText(props.value, '\n', splitBy(/\n/));
  return (
    <Textarea
      id={props.id}
      rows={props.rows ?? 3}
      placeholder={props.placeholder}
      value={text}
      onChange={(event) => props.onChange(update(event.target.value))}
    />
  );
}

export function CommaListInput(props: {
  id: string;
  value: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const { text, update } = useListText(props.value, ', ', splitBy(/,/));
  return (
    <Input
      id={props.id}
      value={text}
      placeholder={props.placeholder}
      onChange={(event) => props.onChange(update(event.target.value))}
    />
  );
}

/** Un elemento de una lista (una experiencia, un estudio…), con su botón para quitarlo. */
export function ItemPanel(props: { title: string; onRemove: () => void; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-xl border border-linea-suave bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <legend className="font-semibold">{props.title}</legend>
        <button
          type="button"
          onClick={props.onRemove}
          className="text-sm text-destructive underline decoration-destructive/35 underline-offset-4 hover:decoration-destructive"
        >
          Quitar
        </button>
      </div>
      {props.children}
    </fieldset>
  );
}
