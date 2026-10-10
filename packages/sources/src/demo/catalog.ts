/**
 * Ofertas del portal de demostración. Todo es inventado: las empresas son nombres de ficción y
 * los textos se arman combinando piezas.
 */

/** Una oferta tal como la entrega el portal en su feed. */
export interface DemoOffer {
  id: number;
  /** Ruta de la oferta dentro del portal. */
  url: string;
  title: string;
  company: string;
  /** Rango como texto ("1900 - 2600"), en dólares al mes. Viene aunque no sea público. */
  salaryRange: string | null;
  /** Solo vienen cuando la empresa publica el sueldo. */
  salaryMin: number | null;
  salaryMax: number | null;
  salaryBasis: 'gross' | 'net';
  salaryPublic: boolean;
  seniority: string;
  /** Jornada, con las palabras del portal. */
  schedule: string;
  workMode: 'onsite' | 'hybrid' | 'remote';
  locationText: string;
  cities: { id: number; name: string }[];
  /** "Chile, Perú o México". */
  countries: string;
  /** "09 de octubre de 2026". */
  publishedAt: string;
  requiresLinkedin: boolean;
  requiresGithub: boolean;
  requiresPortfolio: boolean;
  hasScoredQuestions: boolean;
  quickApply: boolean;
}

/** Lo que solo aparece en la página de la oferta. */
export interface DemoOfferDetail {
  sections: { title: string; paragraphs?: string[]; items?: string[] }[];
  skills: string[];
  benefits: { name: string; description: string }[];
  closed: boolean;
}

export type DemoCatalogEntry = DemoOffer & Partial<DemoOfferDetail>;

const COMPANIES = ['Acme', 'Globex', 'Initech', 'Hooli', 'Soylent', 'Tyrell', 'Wonka', 'Cyberdyne'];

const ROLES = [
  { title: 'Desarrollador/a Front-end', skills: ['React', 'TypeScript', 'CSS'] },
  { title: 'Desarrollador/a Back-end', skills: ['Node.js', 'NestJS', 'SQL'] },
  { title: 'Desarrollador/a Full-Stack', skills: ['React', 'NestJS', 'Docker'] },
  { title: 'Analista de datos', skills: ['SQL', 'Python', 'Power BI'] },
  { title: 'Ingeniero/a QA', skills: ['Playwright', 'TypeScript', 'CI/CD'] },
  { title: 'Ingeniero/a DevOps', skills: ['Docker', 'GitHub Actions', 'Linux'] },
  { title: 'Product Manager', skills: ['Scrum', 'Analítica', 'Roadmaps'] },
];

const SENIORITIES = ['Junior', 'Semi Senior', 'Senior'];

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Fecha como la escribe el portal: "09 de octubre de 2026". */
export function portalDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Arma el catálogo. Es determinista: la misma cantidad y la misma fecha dan las mismas ofertas,
 * de la más reciente a la más antigua.
 */
export function createDemoCatalog(count = 40, today = new Date()): DemoCatalogEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const role = ROLES[index % ROLES.length]!;
    const company = COMPANIES[(index * 3) % COMPANIES.length]!;
    const seniority = SENIORITIES[index % SENIORITIES.length]!;
    const workMode = (['hybrid', 'remote', 'hybrid', 'onsite'] as const)[index % 4]!;
    const salaryMin = 1400 + ((index * 7) % 12) * 150;
    const salaryMax = salaryMin + 500 + (index % 3) * 150;
    const salaryPublic = index % 4 === 0;
    const published = new Date(today);
    published.setDate(published.getDate() - Math.floor(index / 3));
    const id = 5000 - index;

    return {
      id,
      url: `/ofertas/${slugify(`${role.title} ${company} ${id}`)}`,
      title: role.title,
      company,
      salaryRange: `${salaryMin} - ${salaryMax}`,
      salaryMin: salaryPublic ? salaryMin : null,
      salaryMax: salaryPublic ? salaryMax : null,
      salaryBasis: 'gross',
      salaryPublic,
      seniority,
      schedule: index % 9 === 8 ? 'Media jornada' : 'Jornada completa',
      workMode,
      locationText: workMode === 'remote' ? 'Chile, Perú o México' : 'Santiago (Chile)',
      cities: workMode === 'remote' ? [] : [{ id: 1, name: 'Santiago' }],
      countries: workMode === 'remote' ? 'Chile, Perú o México' : 'Chile',
      publishedAt: portalDate(published),
      requiresLinkedin: index % 5 === 0,
      requiresGithub: index % 7 === 0,
      requiresPortfolio: false,
      hasScoredQuestions: index % 6 === 0,
      quickApply: index % 10 === 0,
      sections: [
        {
          title: 'Sobre el cargo',
          paragraphs: [
            `En **${company}** buscamos una persona para el cargo de ${role.title}, nivel ${seniority}. Es una oferta inventada para la demostración.`,
          ],
        },
        {
          title: 'Requisitos',
          items: [...role.skills.map((skill) => `Experiencia con ${skill}.`), 'Trabajo en equipo.'],
        },
        {
          title: 'Deseables',
          items: ['Inglés intermedio.', 'Experiencia en equipos ágiles.'],
        },
      ],
      skills: role.skills,
      benefits: [
        { name: 'Computador', description: `${company} entrega un computador para el trabajo.` },
        { name: 'Horario flexible', description: 'Entrada y salida flexibles.' },
      ],
      closed: false,
    };
  });
}
