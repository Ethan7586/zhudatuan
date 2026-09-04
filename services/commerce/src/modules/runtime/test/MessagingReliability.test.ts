import { describe, expect, it, vi } from 'vitest';
import type { QueryResult } from 'pg';
import { PgInbox } from '../../../adapter/database/PgInbox';
import { PgOutbox } from '../../../adapter/database/PgOutbox';
import type { DeadletterStore } from '../../../foundation/application/DeadletterStore';
import type { OutboxMessage } from '../../../foundation/messaging/Outbox';
import { result, transactionManager, withWriteTransaction } from '../../../test/TransactionFixture';

describe('runtime Outbox and Inbox reliability', () => {
  it('deduplicates Inbox acceptance and makes completion idempotent', async () => {
    let completed = false;
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]): Promise<QueryResult<any>> => {
      if (sql.startsWith('select runtime.accept_inbox')) return result([{ inserted: true }]);
      if (sql.startsWith('update runtime.inbox')) {
        if (completed) return { ...result([]), rowCount: 0 };
        completed = true;
        return { ...result([]), rowCount: 1 };
      }
      if (sql.startsWith('select processed_at')) return result([{ processed: true }]);
      return result([]);
    });
    const inbox = new PgInbox();
    await withWriteTransaction(query, async context => {
      expect(await inbox.accept(context, 'internal', 'job:catalog', event())).toBe(true);
      await inbox.complete(context, 'internal', 'job:catalog', 'event:one');
      await inbox.complete(context, 'internal', 'job:catalog', 'event:one');
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('processed_at is null'))).toBe(true);
  });

  it('claims ordered Outbox heads with SKIP LOCKED and fences publication', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]): Promise<QueryResult<any>> => {
      if (sql.startsWith('with eligible')) return result([event()]);
      if (sql.startsWith('update runtime.outbox set published_at')) return { ...result([]), rowCount: 1 };
      return result([]);
    });
    const outbox = new PgOutbox(transactionManager(query));
    const claimed = await outbox.claim('worker-one', 10, new AbortController().signal, Date.now() + 10_000);
    expect(claimed).toEqual([event()]);
    expect(String(query.mock.calls.find(([sql]) => String(sql).startsWith('with eligible'))?.[0])).toContain('for update skip locked');
    await outbox.published(claimed[0]!, 'worker-one', new AbortController().signal, Date.now() + 10_000);
    const publish = query.mock.calls.find(([sql]) => String(sql).startsWith('update runtime.outbox set published_at'));
    expect(publish?.[1]).toEqual(['event:one', 'worker-one', 3]);
  });

  it('moves an exhausted Outbox receipt to Deadletter before terminal settlement', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]): Promise<QueryResult<any>> => ({ ...result([]), rowCount: 1 }));
    const deadletters = { record: vi.fn(async () => undefined) } satisfies DeadletterStore;
    const outbox = new PgOutbox(transactionManager(query), deadletters);
    await outbox.fail({ ...event(), attempts: 8 }, 'worker-one', new Error('BROKER_UNAVAILABLE'), new AbortController().signal, Date.now() + 10_000, 8);
    expect(deadletters.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'outbox:event:one', error: 'OUTBOX_PUBLISH_FAILED', attempts: 8 }));
    expect(query.mock.calls.some(([, values]) => Array.isArray(values) && values[3] === true && values[5] === 3)).toBe(true);
  });
});

function event(): OutboxMessage {
  return Object.freeze({ id: 'event:one', event_type: 'catalog.product.changed', event_version: 1, aggregate_id: 'product:one', aggregate_version: 1,
    scope_id: 'scope:one', actor_id: 'actor:one', correlation_id: 'correlation:one', causation_id: 'command:one', payload_version: 1,
    payload: Object.freeze({ productId: 'product:one' }), trace_id: 'trace:one', attempts: 1, fencing_token: 3 });
}
