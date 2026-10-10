import {
  JOB_MODALITY_LABELS,
  SALARY_BASIS_LABELS,
  SALARY_PERIOD_LABELS,
  type Contact,
  type JobPreferences,
} from '@job-finder/shared';
import type { ReactNode } from 'react';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

const orDash = (value: string | null | undefined) => value || '—';

export function ContactSummary({ contact }: { contact: Contact }) {
  return (
    <dl>
      <Row label="Correo">{orDash(contact.email)}</Row>
      <Row label="Teléfono">{orDash(contact.phone)}</Row>
      {contact.linkedin && <Row label="LinkedIn">{contact.linkedin}</Row>}
      {contact.github && <Row label="GitHub">{contact.github}</Row>}
      {contact.links.map((link) => (
        <Row key={link.url} label={link.label}>
          {link.url}
        </Row>
      ))}
    </dl>
  );
}

export function PreferencesSummary({ preferences: p }: { preferences: JobPreferences }) {
  const salary = p.salaryMin
    ? `${p.salaryMin.toLocaleString('es-CL')} ${p.salaryCurrency} ${SALARY_PERIOD_LABELS[p.salaryPeriod]} ${SALARY_BASIS_LABELS[p.salaryBasis]}`
    : 'Sin mínimo';
  const relocate = p.willingToRelocate === null ? 'Depende' : p.willingToRelocate ? 'Sí' : 'No';
  return (
    <dl>
      <Row label="Sueldo mínimo">{salary}</Row>
      <Row label="Modalidades">{p.modalities.map((m) => JOB_MODALITY_LABELS[m]).join(', ')}</Row>
      <Row label="Ciudades">{p.cities.length ? p.cities.join(', ') : '—'}</Row>
      <Row label="Cambio de ciudad">{relocate}</Row>
      <Row label="Descartaría">
        {p.dealbreakers.length ? (
          <ul className="list-disc pl-4">
            {p.dealbreakers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          '—'
        )}
      </Row>
      <Row label="Intereses">{p.interests.length ? p.interests.join(', ') : '—'}</Row>
    </dl>
  );
}
