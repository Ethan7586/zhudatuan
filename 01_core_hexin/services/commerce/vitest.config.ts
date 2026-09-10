import { defineConfig } from 'vitest/config';

const pgliteTests = [
  'src/modules/finance/06_tests_ceshi/command/CloseSettlement.test.ts',
  'src/modules/finance/06_tests_ceshi/job/SettlementJob.test.ts',
  'src/modules/finance/06_tests_ceshi/query/GetFinanceOverview.test.ts',
  'src/modules/identity/06_tests_ceshi/IdentityPersistence.test.ts',
  'src/modules/identity/06_tests_ceshi/IdentitySecurity.test.ts',
  'src/modules/member/06_tests_ceshi/MemberReadOperations.test.ts',
  'src/modules/support/06_tests_ceshi/query/GetConversations.test.ts',
];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'commerce-pglite',
          include: pgliteTests,
          environment: 'node',
          fileParallelism: false,
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: 'commerce-parallel',
          include: ['src/**/*.test.ts'],
          exclude: pgliteTests,
          environment: 'node',
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
