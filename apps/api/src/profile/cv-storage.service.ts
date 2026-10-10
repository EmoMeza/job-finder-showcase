import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/** Guarda el PDF del CV de cada usuario en `UPLOADS_DIR/cvs/<userId>.pdf` (uno por usuario). */
@Injectable()
export class CvStorageService {
  private readonly dir: string;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.dir = join(config.get('UPLOADS_DIR', { infer: true }), 'cvs');
  }

  /** Escribe en un archivo temporal y lo renombra: nunca queda un PDF a medio escribir. */
  async save(userId: number, data: Buffer): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const target = this.pathFor(userId);
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, data);
    await rename(temp, target);
  }

  read(userId: number): Promise<Buffer> {
    return readFile(this.pathFor(userId));
  }

  private pathFor(userId: number): string {
    return join(this.dir, `${userId}.pdf`);
  }
}
