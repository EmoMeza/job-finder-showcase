import { describe, expect, it } from 'vitest';
import { loginRequestSchema, passwordSchema } from './auth.js';

describe('loginRequestSchema', () => {
  it('normaliza el email a minúsculas y sin espacios', () => {
    const parsed = loginRequestSchema.parse({ email: '  Emo@Example.COM ', password: 'x' });
    expect(parsed.email).toBe('emo@example.com');
  });

  it('rechaza un email inválido', () => {
    expect(loginRequestSchema.safeParse({ email: 'no-es-email', password: 'x' }).success).toBe(
      false,
    );
  });
});

describe('passwordSchema', () => {
  it('exige un largo mínimo', () => {
    expect(passwordSchema.safeParse('corta').success).toBe(false);
    expect(passwordSchema.safeParse('suficientemente-larga').success).toBe(true);
  });
});
