import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    setupFiles: ['test/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_PATH: ':memory:',
      APP_SECRET: 'app-secret-de-tests-con-al-menos-32-caracteres',
      // Sin pausas entre páginas: los tests leen un sitio local.
      PORTAL_PAUSE_MS: '0',
      // Cada test levanta su propio portal de demostración.
      DEMO_PORTAL_PORT: '0',
    },
  },
});
