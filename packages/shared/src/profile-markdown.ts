import {
  CAREER_LEVEL_LABELS,
  EDUCATION_STATUS_LABELS,
  type Experience,
  type ExperienceKind,
  type ProfileData,
} from './profile.js';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `2022-03` → `mar 2022`; `2022` → `2022`. */
export function formatCvDate(date: string): string {
  const [year, month] = date.split('-');
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : (year ?? date);
}

function formatPeriod(start: string | null, end: string | null, ongoing: boolean): string {
  const from = start ? formatCvDate(start) : '¿?';
  const to = end ? formatCvDate(end) : ongoing ? 'actualidad' : '¿?';
  return `${from} – ${to}`;
}

/** Secciones del `profile.md` según el tipo de experiencia, en este orden. */
const EXPERIENCE_SECTIONS: { title: string; kinds: ExperienceKind[] }[] = [
  { title: 'Experiencia laboral', kinds: ['job', 'freelance'] },
  { title: 'Prácticas', kinds: ['internship'] },
  { title: 'Voluntariado', kinds: ['volunteer'] },
  { title: 'Proyectos', kinds: ['project'] },
];

function experienceBlock(item: Experience): string[] {
  const freelance = item.kind === 'freelance' ? ' · independiente' : '';
  return [
    `### ${item.title} — ${item.company} (${formatPeriod(item.start, item.end, true)})${freelance}`,
    ...item.highlights.map((highlight) => `- ${highlight}`),
    '',
  ];
}

/**
 * Arma el `profile.md` que recibe la IA a partir del perfil estructurado. Determinístico: los
 * mismos datos producen siempre el mismo texto (lo que también ayuda al caché de prompts).
 *
 * Los datos de contacto quedan fuera a propósito: la evaluación de ofertas no los necesita.
 */
export function buildProfileMarkdown(data: ProfileData): string {
  const lines: string[] = [];
  const section = (title: string, body: string[]) => {
    if (body.length > 0) lines.push(`## ${title}`, ...body, '');
  };

  lines.push(`# ${data.fullName || 'Perfil profesional'}`, '');
  if (data.headline) lines.push(`**${data.headline}**`, '');

  const level = [
    data.careerLevel && `Nivel: ${CAREER_LEVEL_LABELS[data.careerLevel]}`,
    data.yearsOfExperience !== null &&
      `${data.yearsOfExperience} ${data.yearsOfExperience === 1 ? 'año' : 'años'} de experiencia`,
  ].filter(Boolean);
  if (level.length > 0) lines.push(level.join(' · '), '');

  section('Resumen', data.summary ? [data.summary] : []);
  for (const { title, kinds } of EXPERIENCE_SECTIONS) {
    section(
      title,
      data.experience.filter((item) => kinds.includes(item.kind)).flatMap(experienceBlock),
    );
  }
  section(
    'Habilidades',
    data.skills.map((group) => `- **${group.name}:** ${group.items.join(', ')}`),
  );
  section(
    'Educación',
    data.education.map((item) => {
      const status = item.status ? ` · ${EDUCATION_STATUS_LABELS[item.status]}` : '';
      return `- ${item.degree} — ${item.institution} (${formatPeriod(item.start, item.end, false)})${status}`;
    }),
  );
  section(
    'Certificaciones',
    data.certifications.map(
      (item) =>
        `- ${item.name}${item.issuer ? ` — ${item.issuer}` : ''}${item.year ? ` (${item.year})` : ''}`,
    ),
  );
  section(
    'Idiomas',
    data.languages.map((item) => `- ${item.language}${item.level ? `: ${item.level}` : ''}`),
  );
  section('Comentarios adicionales', data.additionalInfo ? [data.additionalInfo] : []);

  return `${lines.join('\n').trim()}\n`;
}
