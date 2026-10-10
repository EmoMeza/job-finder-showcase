import type { Page } from 'playwright';
import { PortalChangedError } from '../errors.js';
import type { JobDetail } from '../types.js';

/**
 * Lee la página de una oferta, ya abierta en `page`. El contenido está marcado con `itemprop`
 * (schema.org); ver docs/portal-demo.md.
 */
export async function readJobDetail(page: Page): Promise<JobDetail> {
  const detail = await page.evaluate(extractDetail);
  if (!detail) {
    throw new PortalChangedError('La página no parece una oferta del portal.');
  }
  return {
    description: detail.description || null,
    tags: detail.tags,
    benefits: detail.benefits,
    applyUrl: detail.closed ? null : detail.applyUrl,
    closed: detail.closed,
    raw: { html: detail.html },
  };
}

/* oxlint-disable unicorn/consistent-function-scoping -- sus funciones auxiliares no pueden salir de aquí */
/**
 * Corre dentro de la página, así que no puede usar nada de fuera de la función.
 *
 * La descripción se pasa a Markdown: las secciones llevan los títulos que puso cada empresa
 * ("Requisitos excluyentes", "Beneficios"…), por eso se conservan en vez de buscar nombres fijos.
 */
function extractDetail() {
  if (!document.querySelector('[itemprop="title"]')) return null;

  /** El portal intercala en la descripción textos que oculta con CSS: no son parte de la oferta. */
  const hidden = (el: Element) => getComputedStyle(el).display === 'none';
  const BLOCKS = new Set(['div', 'p', 'ul', 'ol', 'section', 'article', 'blockquote']);
  const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  const collapse = (text: string) => text.replace(/\s+/g, ' ');

  /**
   * Texto de un nodo con negritas y enlaces en Markdown. Las cursivas se dejan como texto: en las
   * descripciones vienen anidadas con negritas y ensucian el resultado. Las sublistas van aparte.
   */
  const inlineNode = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) return collapse(node.textContent ?? '');
    if (!(node instanceof HTMLElement)) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') return '';
    if (tag === 'br') return '\n';
    const inner = inline(node);
    const text = inner.trim();
    if (!text) return inner;
    // Los espacios quedan fuera de las marcas: "**texto** " y no "**texto **".
    const start = inner.indexOf(text);
    const wrap = (open: string, close: string) =>
      `${inner.slice(0, start)}${open}${text}${close}${inner.slice(start + text.length)}`;
    if (tag === 'strong' || tag === 'b') return wrap('**', '**');
    const href = node instanceof HTMLAnchorElement ? node.href : '';
    return /^https?:/.test(href) ? wrap('[', `](${href})`) : inner;
  };
  const inline = (node: Node): string => [...node.childNodes].map(inlineNode).join('');

  const tidy = (text: string) =>
    text
      // Dos negritas seguidas son una sola.
      .replaceAll('****', '')
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');

  const list = (el: Element, depth: number): string[] => {
    const lines: string[] = [];
    let index = 0;
    for (const item of el.children) {
      if (item.tagName.toLowerCase() !== 'li') continue;
      index += 1;
      const marker = el.tagName.toLowerCase() === 'ol' ? `${index}.` : '-';
      const text = tidy(inline(item)).replace(/\n/g, ' ');
      if (text) lines.push(`${'  '.repeat(depth)}${marker} ${text}`);
      for (const nested of item.children) {
        if (['ul', 'ol'].includes(nested.tagName.toLowerCase())) {
          lines.push(...list(nested, depth + 1));
        }
      }
    }
    return lines;
  };

  /** Recorre un contenedor y agrega sus párrafos, títulos y listas a `out`. */
  const blocks = (el: Element, out: string[]) => {
    let run = '';
    const flush = () => {
      const text = tidy(run);
      run = '';
      if (text) out.push(text);
    };
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        run += collapse(child.textContent ?? '');
        continue;
      }
      if (!(child instanceof HTMLElement) || hidden(child)) continue;
      const tag = child.tagName.toLowerCase();
      if (HEADINGS.has(tag)) {
        flush();
        const title = tidy(child.textContent ?? '');
        if (title) out.push(`## ${title}`);
      } else if (tag === 'ul' || tag === 'ol') {
        flush();
        const lines = list(child, 0);
        if (lines.length > 0) out.push(lines.join('\n'));
      } else if (BLOCKS.has(tag)) {
        flush();
        // Los beneficios con ícono se leen aparte, como lista.
        if (!child.classList.contains('beneficios')) blocks(child, out);
      } else {
        run += inlineNode(child);
      }
    }
    flush();
  };

  const description = document.querySelector('[itemprop="description"]');
  const parts: string[] = [];
  if (description) blocks(description, parts);

  const texts = (selector: string) =>
    [...document.querySelectorAll(selector)]
      .map((el) => tidy(el.textContent ?? ''))
      .filter(Boolean);

  const apply = [...document.querySelectorAll<HTMLAnchorElement>('a[href$="/postular"]')]
    .map((link) => link.href)
    .find((href) => /^https?:/.test(href));

  // "Oferta finalizada" se busca fuera de la descripción, que es texto de la empresa.
  const page = document.querySelector('[itemprop="title"]')?.closest('main');
  const outside = (page ?? document.body).cloneNode(true) as Element;
  outside.querySelector('[itemprop="description"]')?.remove();

  return {
    description: parts.join('\n\n'),
    tags: [...new Set(texts('[itemprop="skills"] a'))],
    benefits: [...new Set(texts('[itemprop="description"] .beneficio strong'))],
    applyUrl: apply ?? null,
    closed: /Oferta finalizada/i.test(outside.textContent ?? ''),
    html: description?.outerHTML ?? null,
  };
}
/* oxlint-enable unicorn/consistent-function-scoping */
