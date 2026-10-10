import { describe, expect, it } from 'vitest';
import { SecretBox } from './secret-box.js';

const SECRET = 'un-app-secret-de-prueba-suficientemente-largo';

describe('SecretBox', () => {
  const box = new SecretBox(SECRET);

  it('cifra y descifra', () => {
    const encrypted = box.encrypt('sk-ant-mi-api-key');
    expect(encrypted).not.toContain('sk-ant');
    expect(box.decrypt(encrypted)).toBe('sk-ant-mi-api-key');
  });

  it('usa un IV distinto en cada cifrado', () => {
    expect(box.encrypt('mismo texto')).not.toBe(box.encrypt('mismo texto'));
  });

  it('detecta un texto cifrado modificado', () => {
    const [version, iv, tag, ciphertext] = box.encrypt('sk-ant-mi-api-key').split(':');
    const tampered = Buffer.from(ciphertext!, 'base64url');
    tampered[0] = tampered[0]! ^ 0xff;
    expect(() => box.decrypt([version, iv, tag, tampered.toString('base64url')].join(':'))).toThrow(
      /authenticate/,
    );
  });

  it('no descifra con otro APP_SECRET', () => {
    const other = new SecretBox('otro-app-secret-distinto-y-suficientemente-largo');
    expect(() => other.decrypt(box.encrypt('sk-ant-mi-api-key'))).toThrow(/authenticate/);
  });

  it('rechaza un formato inválido', () => {
    expect(() => box.decrypt('texto-plano')).toThrow(/Formato/);
  });
});
