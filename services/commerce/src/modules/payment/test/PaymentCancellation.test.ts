import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { pgTransactionState } from '../../../adapter/database/PgTransactionState';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { ClaimedJob } from '../../runtime/public/JobProcess';
import type { CancelPayment } from '../application/process/CancelPayment';
import { PgPaymentCancellationProcess } from '../infrastructure/persistence/PgPaymentCancellationProcess';
import { PaymentCancellationJob } from '../interface/job/PaymentCancellationJob';

describe('Payment cancellation event', () => {
  it('maps only an order cancellation from the same scope', async () => {
    const execute = vi.fn(async () => undefined);
    const processor = new PaymentCancellationJob({ execute } as unknown as CancelPayment);
    const signal = new AbortController().signal;
    await processor.process(claimed(), signal, 123);
    expect(execute).toHaveBeenCalledWith(
      { eventId: 'event:cancel', scopeId: 'mall:one', orderId: 'order:one', reason: 'memberrequest' },
      signal,
      123
    );
    expect(() => processor.process({ ...claimed(), scope: 'mall:other' }, signal)).toThrow('PAYMENT_CANCELLATION_SCOPE_MISMATCH');
  });

  it('releases local holds and schedules recovery even when provider close is unknown', async () => {
    const statements: { sql: string; values: readonly unknown[] }[] = [];
    const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      statements.push({ sql, values });
      if (sql.includes('select inbox.event_id')) return result([inbox()]);
      if (sql.includes('select intent.id intent')) {
        return result([{ intent: 'intent:one', orderNumber: 'SW-20260905-1', scene: 'jsapi', applicationHash: 'application-hash' }]);
      }
      if (sql.startsWith('select exists(select 1 from runtime.jobs')) return result([{ existing: false, depth: 0 }]);
      if (sql.includes('update runtime.inbox')) return result([], 1);
      return result([]);
    });
    const manager = {
      write: async (options: Readonly<Record<string, unknown>>, work: (context: WriteTransactionContext) => Promise<unknown>) => {
        const context = { id: 'transaction:one', mode: 'write', ...options } as unknown as WriteTransactionContext;
        return pgTransactionState.run({ client: { query } as unknown as PoolClient, context, mode: 'write', open: true }, () => work(context));
      },
    };
    const close = vi.fn(async () => {
      throw new Error('PAYMENT_PROVIDER_TIMEOUT');
    });
    const release = vi.fn(async () => undefined);
    const process = new PgPaymentCancellationProcess(manager as never, { close } as never, { release });
    const signal = new AbortController().signal;
    await expect(
      process.process(
        { eventId: 'event:cancel', scopeId: 'mall:one', orderId: 'order:one', reason: 'memberrequest' },
        signal,
        Date.now() + 10_000
      )
    ).resolves.toBeUndefined();

    expect(release).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledWith(expect.stringMatching(/^[A-F0-9]{32}$/), { scene: 'jsapi', applicationHash: 'application-hash' },
      expect.objectContaining({ requestId: 'event:cancel', traceId: 'event:cancel', signal }));
    expect(statements.some(({ sql }) => sql.includes("set state='cancelled'"))).toBe(true);
    const scheduled = statements.find(({ sql }) => sql.includes('insert into runtime.job'));
    expect(scheduled?.values).toEqual([
      'job:cancelquery:event:cancel:intent:one',
      'paymentquery',
      'payment',
      'mall:one',
      JSON.stringify({ intent: 'intent:one' }),
      1,
      null,
      'payment',
      null,
    ]);
    expect(statements.some(({ sql }) => sql.includes('update runtime.inbox'))).toBe(true);
  });
});

function claimed(): ClaimedJob {
  return {
    id: 'job:cancel',
    kind: 'paymentcancel',
    scope: 'mall:one',
    authorization: { kind: 'system', actor: 'test', scope: 'mall:one', operation: 'test', source: 'jobs', capturedAt: new Date().toISOString() },
    payload: { eventId: 'event:cancel', event: 'order.cancelled', scopeId: 'mall:one', payload: { order: 'order:one', reason: 'memberrequest' } },
    attempts: 1,
    token: 1,
  };
}

function inbox() {
  return {
    id: 'event:cancel',
    type: 'order.cancelled',
    version: 1,
    aggregate: 'order:one',
    scope: 'mall:one',
    payload: { order: 'order:one', reason: 'memberrequest' },
    occurredAt: '2026-09-05T08:00:00.000Z',
  };
}

function result<T>(rows: readonly T[], rowCount = rows.length): QueryResult<T & Record<string, unknown>> {
  return { rows: rows as (T & Record<string, unknown>)[], rowCount, command: '', oid: 0, fields: [] };
}
