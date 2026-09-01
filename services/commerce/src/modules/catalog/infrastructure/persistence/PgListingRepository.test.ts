import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgListingRepository } from './PgListingRepository';

const context = {} as WriteTransactionContext;

describe('PgListingRepository publication failures', () => {
  it('reports an inactive product separately from a stale listing version', async () => {
    const answers: Readonly<Record<string, unknown>>[][] = [[], [{ status: 'review', version: '3' }]];
    const database = { query: vi.fn(async () => ({ rows: [...(answers.shift() ?? [])], rowCount: 0, command: '', oid: 0, fields: [] })) } as unknown as SqlExecutor;
    const value = new PgListingRepository({ database: () => database } as unknown as PgTransactionAccess, { visible: async () => ['mall:one'] } as never);

    await expect(value.publish(context, 'listing:one', 'mall:one', 3)).rejects.toMatchObject({ code: 'LISTING_NOT_PURCHASABLE', details: { reason: 'PRODUCT_NOT_ACTIVE' } });
  });

  it('retains the concurrency error when the listing version is stale', async () => {
    const answers: Readonly<Record<string, unknown>>[][] = [[], [{ status: 'active', version: '4' }]];
    const database = { query: vi.fn(async () => ({ rows: [...(answers.shift() ?? [])], rowCount: 0, command: '', oid: 0, fields: [] })) } as unknown as SqlExecutor;
    const value = new PgListingRepository({ database: () => database } as unknown as PgTransactionAccess, { visible: async () => ['mall:one'] } as never);

    await expect(value.publish(context, 'listing:one', 'mall:one', 3)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});
