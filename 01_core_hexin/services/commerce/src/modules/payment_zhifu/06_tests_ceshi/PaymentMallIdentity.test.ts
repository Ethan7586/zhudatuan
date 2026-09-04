import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { PaymentDeadletter } from '../04_adapters_shixian/persistence_cunchu/PaymentDeadletter';
import { PaymentPort } from '../01_public_gongkai/ports_jiekou/PaymentPort';
import { RefundPlanner } from '../03_application_yingyong/services_fuwu/RefundPlanner';

describe('Payment mall identity', () => {
  it('writes mall_id from the Payment command into intent, tender, and expiry SQL', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls);
    const port = new PaymentPort();

    await port.plan(database, { mall: 'mall:a', order: 'order:a', orderNumber: 'A-1', member: 'member:a', currency: 'CNY',
      amountMinor: 100, idempotency: 'idem:a', tenders: [{ kind: 'wechat', reference: null, amountMinor: 100 }] });
    await port.expire(database, 'mall:a', 'order:a');

    expect(calls[0]?.text).toContain('payment.intent(id,mall_id');
    expect(calls[0]?.values[1]).toBe('mall:a');
    expect(calls[1]?.text).toContain('payment.intenttender(mall_id,intent_id');
    expect(calls[1]?.values[0]).toBe('mall:a');
    expect(calls[2]?.text).toContain('mall_id=$1');
    expect(calls[2]?.values).toEqual(['mall:a', 'order:a']);
  });

  it('plans a refund entirely inside the requested mall without an Order join', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => {
      if (text.includes('from payment.payment payment')) return [{ intent_id: 'intent:a', currency: 'CNY', captured_minor: 100 }];
      if (text.includes('from payment.intenttender')) return [{ sequence: 1, kind: 'wechat', reference_id: null, amount_minor: 100 }];
      if (text.startsWith('insert into payment.refund(')) return [{ id: 'refund:a', payment_id: 'payment:a', provider: 'wechat',
        provider_reference: 'provider:refund:a', amount_minor: 100, currency: 'CNY', state: 'requested', reason: 'test', aftersale_id: null }];
      return [];
    });

    await new RefundPlanner().create(database, { id: 'refund:a', mall: 'mall:a', payment: 'payment:a', amountMinor: 100,
      idempotency: 'refund-idem:a', reason: 'test' });

    const sql = calls.map(({ text }) => text).join('\n');
    expect(sql).not.toContain('ordering.orderrecord');
    expect(sql).toContain('payment.mall_id=$1');
    expect(sql).toContain('payment.refund(id,mall_id');
    expect(sql).toContain('payment.refundtender(mall_id,refund_id');
  });

  it('keeps webhook, job, refund settlement, and deadletter recovery independent of OrderRecord joins', async () => {
    for (const file of [
      new URL('../05_interface_jieru/http/PaymentWebhook.ts', import.meta.url),
      new URL('../05_interface_jieru/jobs_renwu/PaymentJobs.ts', import.meta.url),
      new URL('../03_application_yingyong/services_fuwu/RefundPlanner.ts', import.meta.url),
      new URL('../03_application_yingyong/services_fuwu/RefundSettlement.ts', import.meta.url),
      new URL('../04_adapters_shixian/persistence_cunchu/PaymentDeadletter.ts', import.meta.url),
    ]) {
      const source = await readFile(file, 'utf8');
      expect(source, file.pathname).not.toMatch(/(?:join|from)\s+ordering\.orderrecord/i);
    }
  });

  it('recovers a legacy unscoped Payment job from its own aggregate mall', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.startsWith('with target as') ? [{ mall_id: 'mall:a' }] : []);

    await new PaymentDeadletter().record(database, { id: 'job:a', kind: 'paymentquery', scope_id: null,
      payload: { intent: 'intent:a' }, attempts: 5 }, 'PAYMENT_QUERY_FAILED');

    expect(calls[0]?.text).toContain('($2::text is null or mall_id=$2)');
    expect(calls[0]?.text).not.toContain('ordering.orderrecord');
    expect(calls[1]?.values[2]).toBe('mall:a');
  });

  it('keeps global order expiry scheduling while executing Payment work one mall at a time', async () => {
    const source = await readFile(new URL('../../order_dingdan/05_interface_jieru/jobs_renwu/OrderJobs.ts', import.meta.url), 'utf8');
    expect(source).toContain('const malls = job.scope_id ? [job.scope_id]');
    expect(source.match(/where intent\.mall_id=\$2/g)).toHaveLength(2);
    expect(source).toContain('paymentPort.expire(client, mall, order)');
  });
});

interface QueryCall { readonly text: string; readonly values: readonly unknown[] }

function recordingDatabase(calls: QueryCall[], rows: (text: string) => readonly QueryResultRow[] = () => []): OperationDatabase {
  return {
    async query<R extends QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
      calls.push({ text, values });
      return { rows: rows(text) as R[] } as QueryResult<R>;
    },
  };
}
