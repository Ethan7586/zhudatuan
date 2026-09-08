import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { Cart } from '../../domain/model/Cart';
import { PgCartRepository } from './PgCartRepository';

function database(rows: ReadonlyArray<ReadonlyArray<Record<string, unknown>>>): SqlExecutor {
  let index = 0;
  return { query: vi.fn(async () => ({ rows: [...(rows[index++] ?? [])], rowCount: 0, command: '', oid: 0, fields: [] })) } as unknown as SqlExecutor;
}

const context = {} as WriteTransactionContext;
const member = Object.freeze({ kind: 'member' as const, member: 'member:1', mall: 'mall:1', application: 'app:1' });
function repository(target: SqlExecutor): PgCartRepository {
  return new PgCartRepository({ database: () => target } as unknown as PgTransactionAccess);
}

describe('PgCartRepository', () => {
  it('rejects a stale cart version while holding the owner-scoped row lock', async () => {
    const target = database([[{ id: 'cart:1', version: 4 }]]);
    await expect(repository(target).lockExisting(context, member, 3)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(target.query).toHaveBeenCalledWith(expect.stringContaining("owner_kind='member'"), ['member:1', 'mall:1', 'app:1']);
  });

  it('uses a cart compare-and-swap and verifies every planned line mutation', async () => {
    const target = database([[]]);
    const cart = new Cart({ id: 'cart:1', owner: member, version: 7, updatedAt: '2026-09-05T00:00:00.000Z', lines: [] });
    await expect(repository(target).mutate(context, cart, [{ listing: 'listing:1', sku: 'sku:1', quantity: 2, selected: true, version: null }])).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(target.query).toHaveBeenCalledWith(expect.stringMatching(/version=\$3[\s\S]*count\(\*\) from applied/), expect.arrayContaining(['cart:1', 7]));
  });

  it('looks up anonymous carts by digest and exact storefront scope without accepting a raw token', async () => {
    const target = database([[]]);
    const digest = 'a'.repeat(64);
    await expect(repository(target).current(context, { kind: 'anonymous', tokenDigest: digest, mall: 'mall:1', application: 'app:1' })).resolves.toBeNull();
    expect(target.query).toHaveBeenCalledWith(expect.stringContaining('token_digest=$1'), [digest, 'mall:1', 'app:1']);
  });

  it('does not expose or consume an anonymous cart from another scope during merge', async () => {
    const target = database([[], []]);
    await expect(repository(target).prepareMerge(context, 'b'.repeat(64), member)).resolves.toEqual({ state: 'none' });
    expect(target.query).toHaveBeenNthCalledWith(2, expect.stringContaining('mall_id=$2 and application_id=$3'), ['b'.repeat(64), 'mall:1', 'app:1']);
  });
});
