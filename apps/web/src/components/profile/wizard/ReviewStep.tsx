import { useFormContext, useWatch } from 'react-hook-form';
import { ProfileDocument } from '../ProfileDocument';
import { ContactSummary, PreferencesSummary } from '../ProfileSummaries';
import { WIZARD_STEPS, type WizardValues } from './form';

/** Último paso: el perfil tal como lo leerá la IA, más lo que no se le envía. */
export function ReviewStep({ goTo }: { goTo: (step: number) => void }) {
  const { control } = useFormContext<WizardValues>();
  const values = useWatch({ control }) as WizardValues;
  const pending = values.recommendations ?? [];

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div role="status" className="rounded-xl border border-primary/30 bg-secondary p-4">
          <p className="font-semibold">
            Dejaste {pending.length} {pending.length === 1 ? 'sugerencia' : 'sugerencias'} sin
            revisar. Puedes confirmar igual.
          </p>
          <ul className="mt-2 space-y-1">
            {pending.map((item) => {
              const step = WIZARD_STEPS.findIndex((s) => s.section === item.section);
              return (
                <li key={item.text} className="text-sm">
                  {item.text}{' '}
                  <button
                    type="button"
                    onClick={() => goTo(step)}
                    className="font-semibold text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary"
                  >
                    Ir a {WIZARD_STEPS[step]?.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ProfileDocument data={values.data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-linea-suave bg-card p-5">
          <h3 className="font-semibold">Contacto</h3>
          <p className="mb-2 text-sm text-muted-foreground">Para postular. No se envía a la IA.</p>
          <ContactSummary contact={values.data.contact} />
        </section>
        <section className="rounded-xl border border-linea-suave bg-card p-5">
          <h3 className="mb-2 font-semibold">Qué buscas</h3>
          <PreferencesSummary preferences={values.preferences} />
        </section>
      </div>
    </div>
  );
}
