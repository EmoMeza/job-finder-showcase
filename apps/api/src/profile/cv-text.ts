import { extractText, getDocumentProxy } from 'unpdf';

/** Los PDF empiezan con `%PDF-`: no se confía solo en el tipo que declara el navegador. */
export function isPdf(data: Buffer): boolean {
  return data.subarray(0, 5).toString('latin1') === '%PDF-';
}

/** Extrae el texto seleccionable del PDF. Un CV escaneado (solo imágenes) devuelve texto vacío. */
export async function extractCvText(data: Buffer): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text: normalizeText(text), pages: totalPages };
}

function normalizeText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
