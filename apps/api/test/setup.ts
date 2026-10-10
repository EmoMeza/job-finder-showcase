import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Cada archivo de test guarda sus archivos (CVs subidos, capturas de búsquedas) en directorios
// propios, así los tests que corren en paralelo no se pisan.
process.env.UPLOADS_DIR = mkdtempSync(join(tmpdir(), 'job-finder-uploads-'));
process.env.ARTIFACTS_DIR = mkdtempSync(join(tmpdir(), 'job-finder-artifacts-'));
