import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import type { ExecutionContext } from '../../../pipeline/HandlerContext';
import type { OrganizationReadPort } from '../../organization/public';
import type { FinanceEntry, FinanceRequest } from '../infrastructure/persistence/FinanceOperation';
import { FinanceScopeQuery } from '../infrastructure/persistence/FinanceScopeQuery';
import { PgFinanceProcessAdapter } from '../infrastructure/persistence/PgFinanceProcessAdapter';

const transaction = { mode: 'read', scope: 'mall:one', membership: 'membership:one' } as ReadTransactionContext;
const database = { transaction } as SqlExecutor;

describe('finance persistence boundaries', () => {
  it('runs the complete lifecycle through the transaction process adapter', async () => {
    const order: string[] = [];
    const discard = vi.fn();
    const entry = {
      load: vi.fn(async () => {
        order.push('load');
        return 'loaded';
      }),
      prepare: vi.fn(async (_request, loaded) => {
        order.push(`prepare:${loaded}`);
        return 'prepared';
      }),
      shortCircuit: vi.fn(() => undefined),
      execute: vi.fn(async (_request, selected, prepared) => {
        order.push(`execute:${selected === database}:${prepared}`);
        return { status: 200, body: { items: [] } };
      }),
      finalize: vi.fn(async (_request, result) => {
        order.push('finalize');
        return result;
      }),
      discard,
    } as FinanceEntry;
    const method = processAdapter().bind<'finance.overview.read'>(entry);

    const result = await method(transaction, { query: {} }, context('finance.overview.read'));

    expect(result).toEqual({ status: 200, body: { items: [] } });
    expect(order).toEqual(['load', 'prepare:loaded', 'execute:true:prepared', 'finalize']);
    expect(discard).not.toHaveBeenCalled();
  });

  it('discards prepared external state when execution fails', async () => {
    const discard = vi.fn();
    const failure = new Error('provider failed');
    const entry = {
      prepare: vi.fn(async () => 'prepared'),
      execute: vi.fn(async () => {
        throw failure;
      }),
      discard,
    } as unknown as FinanceEntry;
    const method = processAdapter().bind<'finance.overview.read'>(entry);

    await expect(method(transaction, { query: {} }, context('finance.overview.read'))).rejects.toBe(failure);
    expect(discard).toHaveBeenCalledWith(expect.any(Object), 'prepared', failure);
  });

  it('centralizes hierarchical scope resolution in one query object', async () => {
    const descendants = vi.fn(async () => ['group:one', 'mall:one']);
    const scopes = new FinanceScopeQuery({ descendants } as unknown as OrganizationReadPort);
    const accessScope = { id: 'mall:one', kind: 'mall' } as Parameters<FinanceScopeQuery['descendants']>[1];

    await expect(scopes.descendants(database, accessScope)).resolves.toEqual(['group:one', 'mall:one']);
    expect(descendants).toHaveBeenCalledWith(transaction, 'mall:one');
  });

  it('keeps supplier and store finance reads inside the exact partner scope', async () => {
    const descendants = vi.fn(async () => ['enterprise:one', 'mall:one']);
    const scopes = new FinanceScopeQuery({ descendants } as unknown as OrganizationReadPort);

    await expect(scopes.descendants(database, { id: 'supplier:one', kind: 'supplier' } as Parameters<FinanceScopeQuery['descendants']>[1])).resolves.toEqual(['supplier:one']);
    await expect(scopes.descendants(database, { id: 'store:one', kind: 'store' } as Parameters<FinanceScopeQuery['descendants']>[1])).resolves.toEqual(['store:one']);
    expect(descendants).not.toHaveBeenCalled();
  });
});

function processAdapter(): PgFinanceProcessAdapter {
  return new PgFinanceProcessAdapter({ database: () => database } as unknown as PgTransactionAccess);
}

function context(operation: 'finance.overview.read'): ExecutionContext<'finance.overview.read'> {
  return {
    operation,
    headers: {},
    rawBody: '',
    deadline: Date.now() + 1_000,
    signal: new AbortController().signal,
    security: { kind: 'system' },
  } as unknown as ExecutionContext<'finance.overview.read'>;
}
