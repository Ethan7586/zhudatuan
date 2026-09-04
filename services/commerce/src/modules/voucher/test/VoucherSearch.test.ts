import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../adapter/database/PgTransactionAccess';
import type { VoucherSearch } from '../application/port/VoucherSearch';
import { PgVoucherSearch } from '../infrastructure/persistence/PgVoucherSearch';

describe('PgVoucherSearch', () => {
  it('always limits storefront search to the authenticated member', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const search = new PgVoucherSearch(access(query));
    await search.read(call('storefront'), { criteria: {}, query: null, fingerprint: null });
    const first = calls(query)[0];
    expect(String(first?.[0])).toContain('holder.member_id=$2');
    expect(first?.[1]).toEqual(['mall:one', 'member:one', null, 101]);
  });

  it('keeps console search scoped without applying a consumer-only holder filter', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const search = new PgVoucherSearch(access(query));
    await search.read(call('console'), { criteria: {}, query: null, fingerprint: null });
    const first = calls(query)[0];
    expect(String(first?.[0])).not.toContain('holder.member_id=$2');
    expect(first?.[1]).toEqual(['mall:one', null, 101]);
  });
});

function call(target: 'storefront' | 'console'): Parameters<VoucherSearch['read']>[0] {
  return { input: { query: { limit: 100 } }, context: { transaction: {} }, scope: 'mall:one', actor: 'principal:one', member: 'member:one', target, idempotency: null, expectedVersion: null, now: new Date('2026-09-05T00:00:00.000Z') } as unknown as Parameters<VoucherSearch['read']>[0];
}
function access(query: ReturnType<typeof vi.fn>): PgTransactionAccess {
  return { database: () => ({ query }) as unknown as SqlExecutor } as unknown as PgTransactionAccess;
}
function calls(query: ReturnType<typeof vi.fn>): readonly (readonly [string, readonly unknown[]])[] {
  return query.mock.calls as unknown as readonly (readonly [string, readonly unknown[]])[];
}
