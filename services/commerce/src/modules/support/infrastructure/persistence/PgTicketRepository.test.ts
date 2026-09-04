import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { withReadTransaction } from '../../../../test/TransactionFixture';
import { PgTicketRepository } from './PgTicketRepository';

describe('PgTicketRepository order lookup', () => {
  it('uses an exact indexed order filter instead of overloading keyword search', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => result([]));
    const repository = new PgTicketRepository(
      {} as never,
      { actor: vi.fn(async () => ({ actor: 'actor:one', membership: 'membership:one', member: 'member:one', target: 'console', scope: 'enterprise:one', scopes: ['enterprise:one'], trace: 'trace:one' })) } as never,
      { findByMembership: vi.fn(async () => null) } as never,
      {} as never,
      {} as never,
      {} as never
    );

    await withReadTransaction(query, (context) => repository.readCases(
      context,
      { query: { limit: 50, orderId: 'order:one' } },
      {} as never
    ));

    const read = query.mock.calls.find(([sql]) => sql.includes('from support.ticket'));
    expect(read?.[0]).toContain('conversation.order_id=$17');
    expect(read?.[1]?.[16]).toBe('order:one');
    expect(read?.[1]?.[11]).toBeNull();
  });
});

function result(rows: readonly unknown[]): QueryResult<any> {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] } as QueryResult<any>;
}
