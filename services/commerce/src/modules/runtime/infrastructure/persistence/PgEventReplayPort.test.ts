import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction } from '../../../../test/TransactionFixture';
import { PgEventReplayPort } from './PgEventReplayPort';

describe('PgEventReplayPort', () => {
  it('reads a bounded Runtime-owned page after a durable cursor and reports overflow', async () => {
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      expect(sql).not.toContain('support.');
      if (sql.includes('where realtime_cursor=$1')) {
        expect(values).toEqual(['10-0', ['mall:one'], 'support.%']);
        return result([{ realtime_published_at: '2026-09-06T00:00:00.000Z', id: 'event:anchor' }]);
      }
      expect(values).toEqual([['mall:one'], 'support.%', '2026-09-06T00:00:00.000Z', 'event:anchor', 2]);
      return result([event('event:one', '11-0'), event('event:overflow', '12-0')]);
    });

    const page = await withReadTransaction(query, (context) =>
      new PgEventReplayPort().after(context, {
        cursor: '10-0',
        scopes: ['mall:one'],
        prefix: 'support.',
        limit: 1,
      })
    );

    expect(page).toMatchObject({ resumeCursor: '11-0', overflow: true });
    expect(page?.events).toHaveLength(1);
    expect(page?.events[0]).toMatchObject({ id: 'event:one', type: 'support.message.sent', cursor: '11-0' });
  });

  it('returns null when the cursor is no longer in the authorized scope', async () => {
    const query = vi.fn(async () => result([]));
    await expect(
      withReadTransaction(query, (context) =>
        new PgEventReplayPort().after(context, {
          cursor: '10-0',
          scopes: ['mall:one'],
          prefix: 'support.',
          limit: 100,
        })
      )
    ).resolves.toBeNull();
  });

  it('finds only published references through the Runtime owner', async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain('from runtime.outbox');
      expect(sql).not.toContain('support.');
      return result([{ reference: 'message:one' }]);
    });
    await expect(
      withReadTransaction(query, (context) =>
        new PgEventReplayPort().publishedReferences(context, {
          type: 'support.message.sent',
          field: 'messageId',
          references: ['message:one'],
          excluding: null,
        })
      )
    ).resolves.toEqual(['message:one']);
  });
});

function event(id: string, cursor: string) {
  return { id, event_type: 'support.message.sent', event_version: 1, scope_id: 'mall:one', aggregate_id: 'conversation:one', payload: { messageId: 'message:one' }, occurred_at: '2026-09-06T00:01:00.000Z', realtime_cursor: cursor };
}
