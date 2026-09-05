import { describe, expect, it, vi } from 'vitest';
import { OperationCatalog } from '@shop/contract';

const captured = vi.hoisted(() => ({ actions: [] as string[] }));

vi.mock('../../../foundation/application/ModuleOperations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../foundation/application/ModuleOperations')>();
  return {
    ...actual,
    ModuleOperations: class {
      constructor(...arguments_: readonly unknown[]) {
        captured.actions = Object.keys(arguments_[3] as Readonly<Record<string, unknown>>);
      }
    },
  };
});

import { financeRoutes } from '../05_interface_jieru/http/FinanceRoutes';

describe('FinanceRoutes operation wiring', () => {
  it('passes all five reconciliation repair actions to ModuleOperations', () => {
    captured.actions = [];
    financeRoutes({ container: { get: () => ({}) } } as never);

    expect(captured.actions).toEqual(expect.arrayContaining([
      'finance.reconciliationrepairs.read',
      'finance.reconciliationrepairs.preview',
      'finance.reconciliationrepairs.submit',
      'finance.reconciliationrepairs.decide',
      'finance.reconciliationrepairs.reverse',
    ]));
  });

  it('matches the complete finance operation catalog', () => {
    captured.actions = [];
    financeRoutes({ container: { get: () => ({}) } } as never);

    const expected = OperationCatalog.all()
      .filter((operation) => operation.module === 'finance')
      .map((operation) => operation.id)
      .sort();
    expect([...captured.actions].sort()).toEqual(expected);
  });
});
