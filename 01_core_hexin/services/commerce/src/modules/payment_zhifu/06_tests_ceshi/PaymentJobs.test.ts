import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { ClaimedJob } from '../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { PaymentGateway, ProviderPaymentObservation, ProviderRefundObservation } from '../01_public_gongkai/ports_jiekou/PaymentGateway';
import { PaymentJobProcessor } from '../05_interface_jieru/jobs_renwu/PaymentJobs';

vi.mock('./application/RefundSettlement', () => ({
  RefundSettlement: class {
    complete(): Promise<void> {
      return Promise.resolve();
    }
  },
}));

const monthEnd = '2026-08-31T23:59:59.987654+08:00';

describe('PaymentJobProcessor provider accounting time', () => {
  it('seals attempt and aggregate capture with the provider month-end instant', async () => {
    const calls: Array<Readonly<{ sql: string; values: readonly unknown[] }>> = [];
    const client = transactionalClient((sql, values) => {
      calls.push({ sql, values });
      if (sql.includes('from payment.intent intent join payment.attempt') && sql.includes('for update of intent,attempt')) {
        return rows([{ intent_state: 'captured', payment: 'payment:intent:one' }]);
      }
      if (sql.includes('update payment.attempt set state=')) return rows([{ id: 'attempt:one' }]);
      if (sql.includes('update payment.capture set completed_at=')) return rows([{ id: 'capture:intent:one' }]);
      return rows([]);
    });
    const pool = paymentPool(client);
    const observed = paymentObservation(monthEnd);
    const provider = gateway({ payment: observed });

    await new PaymentJobProcessor(pool, provider, 'paymentquery').process(job('paymentquery', { intent: 'intent:one' }), new AbortController().signal);

    const attempt = calls.find((call) => call.sql.includes('update payment.attempt set state='));
    const capture = calls.find((call) => call.sql.includes('update payment.capture set completed_at='));
    expect(attempt?.values[2]).toBe(monthEnd);
    expect(capture?.values[1]).toBe(monthEnd);
    expect(String(attempt?.values[3])).toContain('"providerAmountMinor":400');
    expect(String(capture?.values[2])).toContain('"aggregateAmountMinor":1000');
  });

  it.each([undefined, '2026-02-30T23:59:59+08:00', '2026-08-31 23:59:59'])('fails closed before a successful payment mutates state when occurredAt is %s', async (occurredAt) => {
    const client = transactionalClient(() => rows([]));
    const pool = paymentPool(client);
    const provider = gateway({ payment: { ...paymentObservation(monthEnd), occurredAt } as ProviderPaymentObservation });

    await expect(new PaymentJobProcessor(pool, provider, 'paymentquery').process(job('paymentquery', { intent: 'intent:one' }), new AbortController().signal)).rejects.toThrow(/PAYMENT_PROVIDER_OCCURRED_AT/);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('update payment.attempt set state='))).toBe(false);
  });

  it('rejects a conflicting replay instead of replacing an already sealed payment effect', async () => {
    const client = transactionalClient((sql) => {
      if (sql.includes('from payment.intent intent join payment.attempt') && sql.includes('for update of intent,attempt')) {
        return rows([{ intent_state: 'captured', payment: 'payment:intent:one' }]);
      }
      if (sql.includes('update payment.attempt set state=')) return rows([]);
      return rows([]);
    });
    const pool = paymentPool(client);

    await expect(new PaymentJobProcessor(pool, gateway({ payment: paymentObservation(monthEnd) }), 'paymentquery').process(job('paymentquery', { intent: 'intent:one' }), new AbortController().signal)).rejects.toThrow(
      'PAYMENT_PROVIDER_EFFECT_MISMATCH'
    );
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('update payment.capture set completed_at='))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('rollback');
  });

  it('writes a successful refund providerattempt completion at provider time', async () => {
    const calls: Array<Readonly<{ sql: string; values: readonly unknown[] }>> = [];
    const first = transactionalClient((sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith('select id from payment.refund')) return rows([{ id: 'refund:one' }]);
      if (sql.includes("provider_effect->>'reference'") && sql.includes('matches')) return rows([]);
      if (sql.includes("update payment.providerattempt set outcome='succeeded'")) return rows([{ id: 'providerattempt:one' }]);
      if (sql.includes('update channel.provideroperation')) return rows([{ id: 'provideroperation:one' }]);
      return rows([]);
    });
    const second = transactionalClient(() => rows([]));
    const pool = refundPool([first, second]);
    const provider = gateway({ refund: refundObservation(monthEnd) });

    await new PaymentJobProcessor(pool, provider, 'paymentrefund').process(job('paymentrefund', { refund: 'refund:one' }), new AbortController().signal);

    const persisted = calls.find((call) => call.sql.includes("update payment.providerattempt set outcome='succeeded'"));
    expect(persisted?.values[3]).toBe(monthEnd);
    expect(String(persisted?.values[4])).toContain('"kind":"payment.refund"');
  });

  it.each([undefined, 'not-a-provider-time'])('does not seal or complete a successful refund without valid provider time (%s)', async (occurredAt) => {
    const client = transactionalClient(() => rows([]));
    const pool = refundPool([client]);
    const provider = gateway({ refund: { ...refundObservation(monthEnd), occurredAt } as ProviderRefundObservation });

    await expect(new PaymentJobProcessor(pool, provider, 'paymentrefund').process(job('paymentrefund', { refund: 'refund:one' }), new AbortController().signal)).rejects.toThrow(/PAYMENT_REFUND_PROVIDER_OCCURRED_AT/);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('provider_effect_hash=encode'))).toBe(false);
  });

  it('uses an already sealed refund effect after a retry and never asks the provider again', async () => {
    const client = transactionalClient(() => rows([]));
    const pool = refundPool([client], [{ reference: 'wechat-refund:one' }]);
    const provider = gateway({ refund: refundObservation(monthEnd) });

    await new PaymentJobProcessor(pool, provider, 'paymentrefund').process(job('paymentrefund', { refund: 'refund:one' }), new AbortController().signal);

    expect(provider.refund).not.toHaveBeenCalled();
    expect(provider.queryRefund).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith('begin');
    expect(client.query).toHaveBeenCalledWith('commit');
  });
});

function paymentPool(client: ReturnType<typeof transactionalClient>): DatabasePool {
  const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
    if (sql.includes('from payment.intent intent join payment.intenttender')) return intentTarget();
    if (sql.includes('insert into payment.observation')) return rows([]);
    throw new Error(`UNEXPECTED_QUERY:${sql}:${JSON.stringify(values)}`);
  });
  return { query, connect: vi.fn(async () => client), workload: vi.fn(), end: vi.fn() } as unknown as DatabasePool;
}

function refundPool(clients: readonly ReturnType<typeof transactionalClient>[], sealed: readonly Record<string, unknown>[] = []): DatabasePool {
  let connection = 0;
  const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
    if (sql.includes('from payment.refund refund join payment.payment')) return refundTarget();
    if (sql.includes("select provider_effect->>'reference'") && !sql.includes('matches')) return rows(sealed);
    if (sql.includes('select coalesce(max(sequence),0)+1')) return rows([{ sequence: 1 }]);
    if (sql.includes('insert into payment.providerattempt')) return rows([]);
    if (sql.includes('insert into channel.provideroperation')) return rows([]);
    if (sql.includes("update payment.providerattempt set outcome='unknown'")) return rows([{ id: 'providerattempt:one' }]);
    if (sql.includes('update channel.provideroperation')) return rows([{ id: 'provideroperation:one' }]);
    if (sql.includes('with changed as(update payment.refund')) return rows([]);
    throw new Error(`UNEXPECTED_QUERY:${sql}:${JSON.stringify(values)}`);
  });
  return {
    query,
    connect: vi.fn(async () => {
      const client = clients[connection++];
      if (!client) throw new Error('UNEXPECTED_CONNECTION');
      return client;
    }),
    workload: vi.fn(),
    end: vi.fn(),
  } as unknown as DatabasePool;
}

function transactionalClient(handler: (sql: string, values: readonly unknown[]) => QueryResult<Record<string, unknown>>) {
  return {
    query: vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return rows([]);
      return handler(sql, values);
    }),
    release: vi.fn(),
  };
}

function gateway(input: Readonly<{ payment?: ProviderPaymentObservation; refund?: ProviderRefundObservation }>): PaymentGateway {
  return {
    query: vi.fn(async () => input.payment ?? paymentObservation(monthEnd)),
    refund: vi.fn(async () => input.refund ?? refundObservation(monthEnd)),
    queryRefund: vi.fn(async () => input.refund ?? refundObservation(monthEnd)),
  } as unknown as PaymentGateway;
}

function paymentObservation(occurredAt: string): ProviderPaymentObservation {
  return Object.freeze({
    state: 'succeeded',
    transaction: 'wechat-transaction:one',
    amountMinor: 400,
    occurredAt,
    evidence: Object.freeze({ provider: 'wechat', providerRequestId: 'request:one' }),
  });
}

function refundObservation(occurredAt: string): ProviderRefundObservation {
  return Object.freeze({
    state: 'succeeded',
    reference: 'wechat-refund:one',
    occurredAt,
    evidence: Object.freeze({ provider: 'wechat', providerRequestId: 'request:refund:one' }),
  });
}

function intentTarget(): QueryResult<Record<string, unknown>> {
  return rows([
    {
      intent: 'intent:one',
      order_id: 'order:one',
      provider_reference: 'SWPAY202608280001',
      scope_id: 'mall:one',
      mall_id: 'mall:one',
      member_id: 'member:one',
      amount_minor: 1000,
      provider_minor: 400,
      currency: 'CNY',
      intent_state: 'captured',
      attempt: 'attempt:one',
      expires_at: '2026-09-01T00:10:00+08:00',
      scene: 'storefrontMiniapp',
      application_hash: 'a'.repeat(64),
    },
  ]);
}

function refundTarget(): QueryResult<Record<string, unknown>> {
  return rows([
    {
      id: 'refund:one',
      payment_id: 'payment:one',
      state: 'requested',
      amount_minor: 400,
      currency: 'CNY',
      reason: 'refund',
      external_minor: 400,
      external_total: 400,
      transaction: 'wechat-transaction:one',
      order_id: 'order:one',
      scope_id: 'mall:one',
      member_id: 'member:one',
    },
  ]);
}

function job(kind: 'paymentquery' | 'paymentrefund', payload: Readonly<Record<string, unknown>>): ClaimedJob {
  return Object.freeze({ id: `job:${kind}`, kind, scope_id: 'mall:one', payload, attempts: 0 });
}

function rows(values: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows: [...values], rowCount: values.length } as unknown as QueryResult<Record<string, unknown>>;
}
