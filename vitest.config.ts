import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/.git/**', '**/dist/**', '06_history_lishi/**'],
  },
});
