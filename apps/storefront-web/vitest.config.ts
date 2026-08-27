import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      '../../services/commerce-api/src/**/*.test.ts',
      '../../packages/api-contract/src/**/*.test.ts',
      '../../packages/smart-wing-authz/src/**/*.test.ts',
    ],
    clearMocks: true,
  },
});
