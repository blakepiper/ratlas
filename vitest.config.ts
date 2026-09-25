import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/service/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    api: false,
    browser: { enabled: false },
    watch: false,
    maxWorkers: 1,
  },
});
