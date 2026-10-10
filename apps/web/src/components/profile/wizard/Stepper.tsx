import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS } from './form';

/** Progreso del wizard. Es una secuencia real, por eso va numerada. */
export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Pasos del perfil">
      {/* Celular: barra de progreso compacta. */}
      <div className="md:hidden">
        <p className="mb-2 text-sm text-muted-foreground">
          Paso {current + 1} de {WIZARD_STEPS.length}
        </p>
        <div className="h-1.5 rounded-full bg-linea-suave">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${((current + 1) / WIZARD_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="hidden space-y-1 md:block">
        {WIZARD_STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={step.id}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                active && 'bg-card font-semibold text-foreground shadow-xs',
                !active && done && 'text-foreground',
                !active && !done && 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                  !done && !active && 'border-linea-suave',
                )}
              >
                {done ? <Check className="size-3.5" aria-label="Completado" /> : index + 1}
              </span>
              {step.title}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
