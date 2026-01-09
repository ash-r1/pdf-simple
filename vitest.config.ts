import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Use forks pool instead of threads to avoid structuredClone issues
    // with pdfjs-dist's LoopbackPort on Node.js 22/24
    pool: 'forks',
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts', '**/types.ts'],
    },
  },
});
