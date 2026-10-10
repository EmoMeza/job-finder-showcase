import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Los tests de conexión abren un navegador real.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
