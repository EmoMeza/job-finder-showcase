import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/** Archivos que se guardan por ejecución: una falla repetida no debe llenar el disco. */
const MAX_FILES_PER_RUN = 6;
const KEEP_DAYS = 14;

/**
 * Capturas y HTML que deja una búsqueda cuando falla, en `ARTIFACTS_DIR/<ejecución>/`. Muestran
 * el portal con la sesión del usuario, así que solo se entregan a quien es dueño de la ejecución.
 */
@Injectable()
export class RunArtifactsService {
  private readonly dir: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.dir = config.get('ARTIFACTS_DIR', { infer: true });
  }

  /** Guarda un archivo y devuelve el nombre con que quedó, o `null` si ya no cabe ninguno más. */
  async save(runId: number, name: string, content: string | Uint8Array): Promise<string | null> {
    const folder = this.folder(runId);
    await mkdir(folder, { recursive: true });
    if ((await readdir(folder)).length >= MAX_FILES_PER_RUN) return null;
    // El nombre lo arma el adaptador; aun así, nunca sale de la carpeta de la ejecución.
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^\.+/, '');
    await writeFile(join(folder, safeName), content);
    return safeName;
  }

  read(runId: number, name: string): Promise<Buffer> {
    return readFile(join(this.folder(runId), name));
  }

  /** Borra las carpetas de ejecuciones antiguas. */
  async prune(now = new Date()): Promise<void> {
    const limit = now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    const folders = await readdir(this.dir).catch(() => []);
    for (const folder of folders) {
      const path = join(this.dir, folder);
      const info = await stat(path).catch(() => null);
      if (info?.isDirectory() && info.mtimeMs < limit) {
        await rm(path, { recursive: true, force: true });
      }
    }
  }

  private folder(runId: number): string {
    return join(this.dir, String(runId));
  }
}
