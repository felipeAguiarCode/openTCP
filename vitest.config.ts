import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    pool: 'threads',
  },
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __DEV_LAB__: JSON.stringify(true),
  },
});
