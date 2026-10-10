import {
  CAREER_LEVEL_LABELS,
  CAREER_LEVELS,
  EDUCATION_STATUS_LABELS,
  EDUCATION_STATUSES,
  EXPERIENCE_KIND_LABELS,
  EXPERIENCE_KINDS,
  JOB_MODALITIES,
  JOB_MODALITY_LABELS,
  SALARY_BASES,
  SALARY_BASIS_LABELS,
  SALARY_CURRENCIES,
  SALARY_PERIOD_LABELS,
  SALARY_PERIODS,
} from '@job-finder/shared';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  CommaListInput,
  emptyToNull,
  Field,
  ItemPanel,
  LinesTextarea,
  SELECT_CLASS,
  toNumberOrNull,
} from './fields';
import type { WizardValues } from './form';

const DATE_PLACEHOLDER = 'AAAA o AAAA-MM';

function useWizardForm() {
  return useFormContext<WizardValues>();
}

function AddButton(props: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={props.onClick}>
      <Plus />
      {props.label}
    </Button>
  );
}

function EmptyList({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-linea-suave px-4 py-6 text-center text-muted-foreground">
      {children}
    </p>
  );
}

export function BasicsStep() {
  const { register } = useWizardForm();
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="fullName" name="data.fullName">
          <Input id="fullName" autoComplete="name" {...register('data.fullName')} />
        </Field>
        <Field
          label="Profesión o rol"
          htmlFor="headline"
          name="data.headline"
          hint="Ej. Ingeniera Civil Biomédica, Desarrollador Backend"
        >
          <Input id="headline" {...register('data.headline')} />
        </Field>
      </div>
      <Field
        label="Resumen"
        htmlFor="summary"
        name="data.summary"
        hint="2 a 4 frases sobre tu experiencia y lo que haces mejor."
      >
        <Textarea id="summary" rows={5} {...register('data.summary')} />
      </Field>
    </div>
  );
}

export function ContactStep() {
  const { register, control } = useWizardForm();
  const links = useFieldArray({ control, name: 'data.contact.links' });

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Correo" htmlFor="email" name="data.contact.email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register('data.contact.email', { setValueAs: emptyToNull })}
          />
        </Field>
        <Field label="Teléfono" htmlFor="phone" name="data.contact.phone">
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+56 9 1234 5678"
            {...register('data.contact.phone', { setValueAs: emptyToNull })}
          />
        </Field>
        <Field label="LinkedIn (opcional)" htmlFor="linkedin" name="data.contact.linkedin">
          <Input
            id="linkedin"
            placeholder="https://www.linkedin.com/in/…"
            {...register('data.contact.linkedin', { setValueAs: emptyToNull })}
          />
        </Field>
        <Field label="GitHub (opcional)" htmlFor="github" name="data.contact.github">
          <Input
            id="github"
            placeholder="https://github.com/…"
            {...register('data.contact.github', { setValueAs: emptyToNull })}
          />
        </Field>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">Otros enlaces</h3>
          <p className="text-sm text-muted-foreground">
            Portafolio, sitio web, una carpeta de Drive con tus trabajos…
          </p>
        </div>
        {links.fields.map((field, index) => (
          <ItemPanel
            key={field.id}
            title={`Enlace ${index + 1}`}
            onRemove={() => links.remove(index)}
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Field
                label="Nombre"
                htmlFor={`link-${index}-label`}
                name={`data.contact.links.${index}.label`}
              >
                <Input
                  id={`link-${index}-label`}
                  placeholder="Portafolio fotográfico"
                  {...register(`data.contact.links.${index}.label`)}
                />
              </Field>
              <Field
                label="Enlace"
                htmlFor={`link-${index}-url`}
                name={`data.contact.links.${index}.url`}
              >
                <Input
                  id={`link-${index}-url`}
                  placeholder="https://…"
                  {...register(`data.contact.links.${index}.url`)}
                />
              </Field>
            </div>
          </ItemPanel>
        ))}
        <AddButton label="Agregar enlace" onClick={() => links.append({ label: '', url: '' })} />
      </div>
    </div>
  );
}

export function LevelStep() {
  const { register, control } = useWizardForm();
  return (
    <div className="space-y-6">
      <Controller
        control={control}
        name="data.careerLevel"
        render={({ field }) => (
          <fieldset className="space-y-3">
            <legend className="font-semibold">Nivel de experiencia</legend>
            <RadioGroup
              value={field.value ?? 'none'}
              onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {[...CAREER_LEVELS, 'none' as const].map((level) => (
                <Label
                  key={level}
                  htmlFor={`level-${level}`}
                  className="flex items-center gap-3 rounded-lg border border-input bg-card px-3 py-2.5 font-normal has-data-checked:border-primary has-data-checked:bg-secondary"
                >
                  <RadioGroupItem id={`level-${level}`} value={level} />
                  {level === 'none'
                    ? 'No aplica o prefiero no indicar'
                    : CAREER_LEVEL_LABELS[level]}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
        )}
      />
      <Field
        label="Años de experiencia"
        htmlFor="years"
        name="data.yearsOfExperience"
        hint="Contando empleos, prácticas y trabajo independiente."
        className="max-w-48"
      >
        <Input
          id="years"
          type="number"
          min={0}
          max={60}
          inputMode="numeric"
          {...register('data.yearsOfExperience', { setValueAs: toNumberOrNull })}
        />
      </Field>
    </div>
  );
}

export function ExperienceStep() {
  const { register, control } = useWizardForm();
  const { fields, append, remove } = useFieldArray({ control, name: 'data.experience' });

  return (
    <div className="space-y-4">
      {fields.length === 0 && <EmptyList>Todavía no agregas experiencia.</EmptyList>}
      {fields.map((field, index) => (
        <ItemPanel key={field.id} title={`Experiencia ${index + 1}`} onRemove={() => remove(index)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tipo"
              htmlFor={`exp-${index}-kind`}
              name={`data.experience.${index}.kind`}
            >
              <select
                id={`exp-${index}-kind`}
                className={SELECT_CLASS}
                {...register(`data.experience.${index}.kind`)}
              >
                {EXPERIENCE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {EXPERIENCE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="hidden sm:block" />
            <Field
              label="Cargo o rol"
              htmlFor={`exp-${index}-title`}
              name={`data.experience.${index}.title`}
            >
              <Input id={`exp-${index}-title`} {...register(`data.experience.${index}.title`)} />
            </Field>
            <Field
              label="Empresa u organización"
              htmlFor={`exp-${index}-company`}
              name={`data.experience.${index}.company`}
            >
              <Input
                id={`exp-${index}-company`}
                {...register(`data.experience.${index}.company`)}
              />
            </Field>
            <Field
              label="Desde"
              htmlFor={`exp-${index}-start`}
              name={`data.experience.${index}.start`}
            >
              <Input
                id={`exp-${index}-start`}
                placeholder={DATE_PLACEHOLDER}
                {...register(`data.experience.${index}.start`, { setValueAs: emptyToNull })}
              />
            </Field>
            <Controller
              control={control}
              name={`data.experience.${index}.end`}
              render={({ field: end }) => (
                <Field
                  label="Hasta"
                  htmlFor={`exp-${index}-end`}
                  name={`data.experience.${index}.end`}
                >
                  <Input
                    id={`exp-${index}-end`}
                    placeholder={end.value === null ? 'Actualidad' : DATE_PLACEHOLDER}
                    disabled={end.value === null}
                    value={end.value ?? ''}
                    onChange={(event) => end.onChange(event.target.value)}
                  />
                  <Label htmlFor={`exp-${index}-current`} className="pt-1 font-normal">
                    <Checkbox
                      id={`exp-${index}-current`}
                      checked={end.value === null}
                      onCheckedChange={(checked) => end.onChange(checked === true ? null : '')}
                    />
                    Sigue vigente
                  </Label>
                </Field>
              )}
            />
          </div>
          <Controller
            control={control}
            name={`data.experience.${index}.highlights`}
            render={({ field: highlights }) => (
              <Field
                label="Responsabilidades y logros"
                htmlFor={`exp-${index}-highlights`}
                name={`data.experience.${index}.highlights`}
                hint="Uno por línea."
              >
                <LinesTextarea
                  id={`exp-${index}-highlights`}
                  value={highlights.value}
                  onChange={highlights.onChange}
                  rows={4}
                />
              </Field>
            )}
          />
        </ItemPanel>
      ))}
      <AddButton
        label="Agregar experiencia"
        onClick={() =>
          append({ kind: 'job', title: '', company: '', start: null, end: null, highlights: [] })
        }
      />
    </div>
  );
}

export function EducationStep() {
  const { register, control } = useWizardForm();
  const { fields, append, remove } = useFieldArray({ control, name: 'data.education' });

  return (
    <div className="space-y-4">
      {fields.length === 0 && <EmptyList>Todavía no agregas estudios.</EmptyList>}
      {fields.map((field, index) => (
        <ItemPanel key={field.id} title={`Estudio ${index + 1}`} onRemove={() => remove(index)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Título o carrera"
              htmlFor={`edu-${index}-degree`}
              name={`data.education.${index}.degree`}
            >
              <Input id={`edu-${index}-degree`} {...register(`data.education.${index}.degree`)} />
            </Field>
            <Field
              label="Institución"
              htmlFor={`edu-${index}-institution`}
              name={`data.education.${index}.institution`}
            >
              <Input
                id={`edu-${index}-institution`}
                {...register(`data.education.${index}.institution`)}
              />
            </Field>
            <Field
              label="Desde"
              htmlFor={`edu-${index}-start`}
              name={`data.education.${index}.start`}
            >
              <Input
                id={`edu-${index}-start`}
                placeholder={DATE_PLACEHOLDER}
                {...register(`data.education.${index}.start`, { setValueAs: emptyToNull })}
              />
            </Field>
            <Field label="Hasta" htmlFor={`edu-${index}-end`} name={`data.education.${index}.end`}>
              <Input
                id={`edu-${index}-end`}
                placeholder={DATE_PLACEHOLDER}
                {...register(`data.education.${index}.end`, { setValueAs: emptyToNull })}
              />
            </Field>
            <Field
              label="Estado"
              htmlFor={`edu-${index}-status`}
              name={`data.education.${index}.status`}
            >
              <select
                id={`edu-${index}-status`}
                className={SELECT_CLASS}
                {...register(`data.education.${index}.status`, { setValueAs: emptyToNull })}
              >
                <option value="">Sin indicar</option>
                {EDUCATION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {EDUCATION_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </ItemPanel>
      ))}
      <AddButton
        label="Agregar estudio"
        onClick={() =>
          append({ degree: '', institution: '', start: null, end: null, status: null })
        }
      />
    </div>
  );
}

export function SkillsStep() {
  const { register, control } = useWizardForm();
  const { fields, append, remove } = useFieldArray({ control, name: 'data.skills' });

  return (
    <div className="space-y-4">
      {fields.length === 0 && <EmptyList>Todavía no agregas habilidades.</EmptyList>}
      {fields.map((field, index) => (
        <ItemPanel key={field.id} title={`Grupo ${index + 1}`} onRemove={() => remove(index)}>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <Field
              label="Nombre del grupo"
              htmlFor={`skill-${index}-name`}
              name={`data.skills.${index}.name`}
            >
              <Input
                id={`skill-${index}-name`}
                placeholder="Ej. Equipamiento médico"
                {...register(`data.skills.${index}.name`)}
              />
            </Field>
            <Controller
              control={control}
              name={`data.skills.${index}.items`}
              render={({ field: items }) => (
                <Field
                  label="Habilidades"
                  htmlFor={`skill-${index}-items`}
                  name={`data.skills.${index}.items`}
                  hint="Separadas por comas."
                >
                  <CommaListInput
                    id={`skill-${index}-items`}
                    value={items.value}
                    onChange={items.onChange}
                  />
                </Field>
              )}
            />
          </div>
        </ItemPanel>
      ))}
      <AddButton label="Agregar grupo" onClick={() => append({ name: '', items: [] })} />
    </div>
  );
}

export function LanguagesStep() {
  const { register, control } = useWizardForm();
  const languages = useFieldArray({ control, name: 'data.languages' });
  const certifications = useFieldArray({ control, name: 'data.certifications' });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Idiomas</h3>
        {languages.fields.length === 0 && <EmptyList>Todavía no agregas idiomas.</EmptyList>}
        {languages.fields.map((field, index) => (
          <ItemPanel
            key={field.id}
            title={`Idioma ${index + 1}`}
            onRemove={() => languages.remove(index)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Idioma"
                htmlFor={`lang-${index}-language`}
                name={`data.languages.${index}.language`}
              >
                <Input
                  id={`lang-${index}-language`}
                  {...register(`data.languages.${index}.language`)}
                />
              </Field>
              <Field
                label="Nivel"
                htmlFor={`lang-${index}-level`}
                name={`data.languages.${index}.level`}
                hint="Ej. intermedio, B2, nativo"
              >
                <Input
                  id={`lang-${index}-level`}
                  {...register(`data.languages.${index}.level`, { setValueAs: emptyToNull })}
                />
              </Field>
            </div>
          </ItemPanel>
        ))}
        <AddButton
          label="Agregar idioma"
          onClick={() => languages.append({ language: '', level: null })}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Certificaciones y cursos</h3>
        {certifications.fields.length === 0 && (
          <EmptyList>Todavía no agregas certificaciones.</EmptyList>
        )}
        {certifications.fields.map((field, index) => (
          <ItemPanel
            key={field.id}
            title={`Certificación ${index + 1}`}
            onRemove={() => certifications.remove(index)}
          >
            <div className="grid gap-4 sm:grid-cols-[2fr_1.5fr_1fr]">
              <Field
                label="Nombre"
                htmlFor={`cert-${index}-name`}
                name={`data.certifications.${index}.name`}
              >
                <Input
                  id={`cert-${index}-name`}
                  {...register(`data.certifications.${index}.name`)}
                />
              </Field>
              <Field
                label="Emisor"
                htmlFor={`cert-${index}-issuer`}
                name={`data.certifications.${index}.issuer`}
              >
                <Input
                  id={`cert-${index}-issuer`}
                  {...register(`data.certifications.${index}.issuer`, { setValueAs: emptyToNull })}
                />
              </Field>
              <Field
                label="Año"
                htmlFor={`cert-${index}-year`}
                name={`data.certifications.${index}.year`}
              >
                <Input
                  id={`cert-${index}-year`}
                  inputMode="numeric"
                  {...register(`data.certifications.${index}.year`, { setValueAs: emptyToNull })}
                />
              </Field>
            </div>
          </ItemPanel>
        ))}
        <AddButton
          label="Agregar certificación"
          onClick={() => certifications.append({ name: '', issuer: null, year: null })}
        />
      </section>

      <Field
        label="Comentarios adicionales"
        htmlFor="additionalInfo"
        name="data.additionalInfo"
        hint="Lo relevante que no calce en otra parte: licencia de conducir, disponibilidad, publicaciones…"
      >
        <Textarea id="additionalInfo" rows={4} {...register('data.additionalInfo')} />
      </Field>
    </div>
  );
}

export function PreferencesStep() {
  const { register, control } = useWizardForm();
  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="font-semibold">Sueldo mínimo que aceptarías</legend>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Sueldo mínimo"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="Sin mínimo"
            className="w-44"
            {...register('preferences.salaryMin', { setValueAs: toNumberOrNull })}
          />
          <select
            aria-label="Moneda"
            className={cn(SELECT_CLASS, 'w-auto')}
            {...register('preferences.salaryCurrency')}
          >
            {SALARY_CURRENCIES.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
          <select
            aria-label="Periodo"
            className={cn(SELECT_CLASS, 'w-auto')}
            {...register('preferences.salaryPeriod')}
          >
            {SALARY_PERIODS.map((period) => (
              <option key={period} value={period}>
                {SALARY_PERIOD_LABELS[period]}
              </option>
            ))}
          </select>
          <select
            aria-label="Tipo de sueldo"
            className={cn(SELECT_CLASS, 'w-auto')}
            {...register('preferences.salaryBasis')}
          >
            {SALARY_BASES.map((basis) => (
              <option key={basis} value={basis}>
                {SALARY_BASIS_LABELS[basis]}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <Controller
        control={control}
        name="preferences.modalities"
        render={({ field, fieldState }) => (
          <fieldset className="space-y-2">
            <legend className="font-semibold">Modalidades que aceptas</legend>
            <div className="flex flex-wrap gap-2">
              {JOB_MODALITIES.map((modality) => (
                <Label
                  key={modality}
                  htmlFor={`modality-${modality}`}
                  className="rounded-lg border border-input bg-card px-3 py-2 font-normal has-data-checked:border-primary has-data-checked:bg-secondary"
                >
                  <Checkbox
                    id={`modality-${modality}`}
                    checked={field.value.includes(modality)}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked === true
                          ? [...field.value, modality]
                          : field.value.filter((item) => item !== modality),
                      )
                    }
                  />
                  {JOB_MODALITY_LABELS[modality]}
                </Label>
              ))}
            </div>
            {fieldState.error && (
              <p className="text-sm text-destructive">{fieldState.error.message}</p>
            )}
          </fieldset>
        )}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Controller
          control={control}
          name="preferences.cities"
          render={({ field }) => (
            <Field
              label="Ciudades"
              htmlFor="cities"
              hint="Para trabajo híbrido o presencial. Una por línea."
            >
              <LinesTextarea
                id="cities"
                value={field.value}
                onChange={field.onChange}
                placeholder="Concepción"
              />
            </Field>
          )}
        />
        <Controller
          control={control}
          name="preferences.willingToRelocate"
          render={({ field }) => (
            <fieldset className="space-y-2">
              <legend className="font-semibold">¿Te cambiarías de ciudad?</legend>
              <RadioGroup
                value={field.value === null ? 'unknown' : field.value ? 'yes' : 'no'}
                onValueChange={(value) =>
                  field.onChange(value === 'unknown' ? null : value === 'yes')
                }
              >
                {(
                  [
                    ['yes', 'Sí'],
                    ['no', 'No'],
                    ['unknown', 'Depende de la oferta'],
                  ] as const
                ).map(([value, label]) => (
                  <Label key={value} htmlFor={`relocate-${value}`} className="font-normal">
                    <RadioGroupItem id={`relocate-${value}`} value={value} />
                    {label}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
          )}
        />
      </div>

      <Controller
        control={control}
        name="preferences.dealbreakers"
        render={({ field }) => (
          <Field
            label="Lo que descartaría una oferta"
            htmlFor="dealbreakers"
            hint="Escríbelo con tus palabras, uno por línea. La IA lo interpreta al evaluar cada oferta."
          >
            <LinesTextarea
              id="dealbreakers"
              rows={4}
              value={field.value}
              onChange={field.onChange}
              placeholder={
                'Que implique conducir un vehículo\nTurnos de noche\nViajar más de una semana al mes'
              }
            />
          </Field>
        )}
      />
      <Controller
        control={control}
        name="preferences.interests"
        render={({ field }) => (
          <Field
            label="Hacia dónde quieres orientar tu carrera"
            htmlFor="interests"
            hint="Áreas, industrias o temas que te interesan. Uno por línea."
          >
            <LinesTextarea
              id="interests"
              rows={3}
              value={field.value}
              onChange={field.onChange}
              placeholder={'Dispositivos médicos\nInvestigación clínica'}
            />
          </Field>
        )}
      />
    </div>
  );
}
