import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12; // recomendado para GCM

/**
 * Cifrado simétrico para secretos guardados en la base de datos (ej. API keys de usuarios).
 * AES-256-GCM: además de cifrar, detecta cualquier modificación del texto cifrado.
 * La clave se deriva de APP_SECRET con HKDF, así APP_SECRET nunca se usa directamente.
 *
 * Formato: `v1:<iv>:<authTag>:<ciphertext>` (base64url).
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(appSecret: string) {
    // 'job-finder' es una etiqueta fija de la derivación. No se cambia: con otra etiqueta, lo ya
    // cifrado en la base de datos no se podría descifrar.
    this.key = Buffer.from(hkdfSync('sha256', appSecret, 'job-finder', 'secret-box', 32));
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [VERSION, iv, cipher.getAuthTag(), ciphertext]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
      .join(':');
  }

  /** Lanza un error si el valor fue modificado o se cifró con otra clave. */
  decrypt(payload: string): string {
    const [version, iv, authTag, ciphertext] = payload.split(':');
    if (version !== VERSION || !iv || !authTag || ciphertext === undefined) {
      throw new Error('Formato de secreto cifrado inválido');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
