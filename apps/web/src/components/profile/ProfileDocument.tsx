import { buildProfileMarkdown, type ProfileData } from '@job-finder/shared';
import Markdown from 'react-markdown';

/** El `profile.md` como una hoja de documento: lo que lee la IA al evaluar ofertas. */
export function ProfileDocument({ data }: { data: ProfileData }) {
  return (
    <article
      aria-label="Perfil que lee la IA"
      className="prose max-w-none rounded-sm border border-linea-suave bg-card px-8 py-10 shadow-[0_1px_2px_rgb(31_42_68/0.06),0_8px_24px_-12px_rgb(31_42_68/0.18)] prose-headings:text-foreground prose-h1:mb-2 prose-h2:mt-8 prose-h2:border-b prose-h2:border-linea-suave prose-h2:pb-1 prose-h3:text-base sm:px-12"
    >
      <Markdown>{buildProfileMarkdown(data)}</Markdown>
    </article>
  );
}
