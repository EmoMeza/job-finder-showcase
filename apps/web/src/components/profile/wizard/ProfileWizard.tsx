import { zodResolver } from '@hookform/resolvers/zod';
import type { ProfileDraft } from '@job-finder/shared';
import { useState, type FormEvent } from 'react';
import { FormProvider, get, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { useConfirmDraft, useDiscardDraft, useSaveDraft } from '@/lib/profile';
import {
  PrefilledContext,
  REVIEW_STEP,
  WIZARD_STEPS,
  wizardSchema,
  type WizardValues,
} from './form';
import { RecommendationsBox } from './RecommendationsBox';
import { ReviewStep } from './ReviewStep';
import {
  BasicsStep,
  ContactStep,
  EducationStep,
  ExperienceStep,
  LanguagesStep,
  LevelStep,
  PreferencesStep,
  SkillsStep,
} from './StepContent';
import { Stepper } from './Stepper';

const STEP_BODIES: Record<string, () => React.JSX.Element> = {
  basics: BasicsStep,
  contact: ContactStep,
  level: LevelStep,
  experience: ExperienceStep,
  education: EducationStep,
  skills: SkillsStep,
  languages: LanguagesStep,
  preferences: PreferencesStep,
};

/**
 * Wizard del perfil. Valida cada paso antes de avanzar y guarda el borrador en el servidor, así
 * se puede retomar. El perfil confirmado no cambia hasta "Confirmar perfil".
 */
export function ProfileWizard({ draft }: { draft: ProfileDraft }) {
  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      data: draft.data,
      preferences: draft.preferences,
      recommendations: draft.recommendations,
    },
  });
  const [current, setCurrent] = useState(Math.min(Math.max(draft.step, 1), REVIEW_STEP));
  // Paso más lejano alcanzado: los anteriores ya se revisaron.
  const [furthest, setFurthest] = useState(current);
  const save = useSaveDraft();
  const confirm = useConfirmDraft();
  const discard = useDiscardDraft();

  const step = WIZARD_STEPS[current]!;
  const StepBody = STEP_BODIES[step.id];
  const prefilled = draft.source === 'cv' && step.prefillable && current >= furthest;
  const busy = save.isPending || confirm.isPending;

  function goTo(index: number) {
    setCurrent(index);
    window.scrollTo({ top: 0 });
  }

  async function handleNext() {
    if (step.fields.length > 0 && !(await form.trigger(step.fields, { shouldFocus: true }))) return;
    const next = current + 1;
    const reached = Math.max(furthest, next);
    save.mutate(
      { source: draft.source, step: reached, ...form.getValues() },
      {
        onSuccess: () => {
          setFurthest(reached);
          goTo(next);
        },
      },
    );
  }

  async function handleConfirm() {
    if (!(await form.trigger())) {
      // Lleva al primer paso con errores.
      const errors = form.formState.errors;
      const firstInvalid = WIZARD_STEPS.findIndex((s) =>
        s.fields.some((path) => get(errors, path) !== undefined),
      );
      if (firstInvalid > 0) goTo(firstInvalid);
      return;
    }
    save.mutate(
      { source: draft.source, step: REVIEW_STEP, ...form.getValues() },
      { onSuccess: () => confirm.mutate() },
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void (current === REVIEW_STEP ? handleConfirm() : handleNext());
  }

  function handleDiscard() {
    if (window.confirm('¿Descartar los cambios? Tu perfil confirmado no cambia.')) discard.mutate();
  }

  const error = save.error ?? confirm.error ?? discard.error;

  return (
    <FormProvider {...form}>
      <div className="grid gap-8 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="space-y-6 md:sticky md:top-6 md:self-start">
          <Stepper current={current} />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDiscard}
            disabled={discard.isPending}
          >
            Descartar cambios
          </Button>
        </aside>

        <form onSubmit={handleSubmit} noValidate className="max-w-3xl space-y-6">
          <header className="space-y-2">
            <p className="hidden text-sm text-muted-foreground md:block">
              Paso {current + 1} de {WIZARD_STEPS.length}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">{step.title}</h1>
            <p className="text-muted-foreground">{step.description}</p>
            {prefilled && (
              <p className="flex items-center gap-2 text-sm">
                <span className="inline-block h-3 w-6 rounded-sm bg-destacador" aria-hidden />
                Lo marcado en amarillo lo completamos desde tu CV. Revísalo antes de seguir.
              </p>
            )}
          </header>

          {step.section && <RecommendationsBox section={step.section} />}

          <PrefilledContext.Provider value={prefilled}>
            {StepBody ? <StepBody /> : <ReviewStep goTo={goTo} />}
          </PrefilledContext.Provider>

          {error && (
            <p role="alert" className="text-destructive">
              {error.message}
            </p>
          )}

          <footer className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-4 backdrop-blur">
            <Button
              type="button"
              variant="outline"
              onClick={() => goTo(current - 1)}
              disabled={current <= 1 || busy}
            >
              Atrás
            </Button>
            <Button type="submit" size="lg" disabled={busy}>
              {current === REVIEW_STEP
                ? confirm.isPending
                  ? 'Confirmando…'
                  : 'Confirmar perfil'
                : save.isPending
                  ? 'Guardando…'
                  : 'Siguiente'}
            </Button>
          </footer>
        </form>
      </div>
    </FormProvider>
  );
}
