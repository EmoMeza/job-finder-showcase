import { describe, expect, it } from 'vitest';
import { validateEnv as validate } from './env.js';

const APP_SECRET = 'x'.repeat(32);
const validateEnv = (raw: Record<string, unknown>) => validate({ APP_SECRET, ...raw });

describe('validateEnv', () => {
  it('aplica valores por defecto', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_PATH: 'data/job-finder.sqlite',
      UPLOADS_DIR: 'data/uploads',
      ARTIFACTS_DIR: 'data/artifacts',
      SEARCH_MAX_LISTINGS: 100,
      SEARCH_MAX_DETAILS: 30,
      PORTAL_PAUSE_MS: 1000,
      DEMO_PORTAL_PORT: 4100,
      DEMO_PORTAL_HOST: '127.0.0.1',
      SESSION_TTL_DAYS: 30,
      SESSION_COOKIE_SECURE: false,
      APP_SECRET,
      LLM_MODEL: 'claude-opus-5-5',
      LLM_EFFORT: 'medium',
      LLM_TIMEOUT_MS: 180_000,
      CLAUDE_CLI_PATH: 'claude',
    });
  });

  it('convierte PORT a número', () => {
    expect(validateEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('interpreta booleanos escritos como texto', () => {
    expect(validateEnv({ SESSION_COOKIE_SECURE: 'true' }).SESSION_COOKIE_SECURE).toBe(true);
  });

  it('usa cookie Secure por defecto en producción, salvo que se desactive', () => {
    expect(validateEnv({ NODE_ENV: 'production' }).SESSION_COOKIE_SECURE).toBe(true);
    expect(
      validateEnv({ NODE_ENV: 'production', SESSION_COOKIE_SECURE: 'false' }).SESSION_COOKIE_SECURE,
    ).toBe(false);
  });

  it('exige un APP_SECRET largo', () => {
    expect(() => validate({})).toThrow(/APP_SECRET/);
    expect(() => validate({ APP_SECRET: 'corto' })).toThrow(/APP_SECRET/);
  });

  it('falla con un mensaje legible si un valor es inválido', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });
});
