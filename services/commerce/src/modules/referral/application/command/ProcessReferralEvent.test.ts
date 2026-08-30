import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { ProcessReferralEvent } from './ProcessReferralEvent';

describe('ProcessReferralEvent', () => {
  it('uses authoritative facts, creates one direct and one immediate reward, and makes replay a no-op', async () => {
    let pending = true;
    const payload = { order: 'order:one', totalMinor: 1, lines: [] };
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return result([]);
      if (sql.includes('join runtime.outbox') && sql.includes('for update')) {
        return result(pending ? [{ scope_id: 'mall:one', occurred_at: '2026-08-29T01:00:00.000Z', payload }] : []);
      }
      if (sql.includes('processed_at is not null')) return result([{ accepted: 1 }]);
      if (sql.includes('from ordering.orderrecord orders')) return result([orderFact({ total_minor: '1000', benefit_minor: '300' })]);
      if (sql.includes('from referral.setting')) return result([{ enabled: true, reward_enabled: true, settle_trigger: 'on_paid', settle_delay_days: 2, version: 3 }]);
      if (sql.includes('from referral.binding')) return result([{ referral_member_id: 'referral:direct', direct_member_id: 'member:direct', inviter_member_id: 'member:inviter' }]);
      if (sql.includes('from ordering.line line')) return result([{ id: 'line:one', sku_id: 'sku:one', payable_minor: '1000', product_enabled: true, commission_bps: 500, reward_bps: 100, product_version: 4 }]);
      if (sql.includes('insert into referral.commission')) return result([]);
      if (sql.includes('update runtime.inbox')) {
        pending = false;
        return result([]);
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;
    const event = { eventId: 'event:one', event: 'order.placed', payload: { tampered: true } } as const;

    const processor = new ProcessReferralEvent(pool);
    await processor.execute(event);
    await processor.execute(event);

    const inserts = query.mock.calls.filter(([sql]) => sql.includes('insert into referral.commission'));
    expect(inserts).toHaveLength(2);
    expect(inserts.map(([, values]) => values?.slice(5, 11))).toEqual([
      ['member:direct', 'commission', 'CNY', 700, 500, 35],
      ['member:inviter', 'reward', 'CNY', 700, 100, 7],
    ]);
    expect(query.mock.calls.filter(([sql]) => sql.includes('update runtime.inbox'))).toHaveLength(1);
    expect(query.mock.calls.filter(([sql]) => sql === 'commit')).toHaveLength(2);
  });

  it('creates nothing when the customer has no active binding', async () => {
    const payload = { order: 'order:unbound' };
    const query = vi.fn(async (sql: string) => {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback' || sql.includes('update runtime.inbox')) return result([]);
      if (sql.includes('join runtime.outbox')) return result([{ scope_id: 'mall:one', occurred_at: '2026-08-29T01:00:00.000Z', payload }]);
      if (sql.includes('from ordering.orderrecord orders')) return result([orderFact()]);
      if (sql.includes('from referral.setting')) return result([{ enabled: true, reward_enabled: true, settle_trigger: 'on_paid', settle_delay_days: 0, version: 0 }]);
      if (sql.includes('from referral.binding')) return result([]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await new ProcessReferralEvent(pool).execute({ eventId: 'event:unbound', event: 'order.placed' });

    expect(query.mock.calls.some(([sql]) => sql.includes('insert into referral.commission'))).toBe(false);
  });

  it('fails closed when an authoritative order belongs to another scope', async () => {
    const payload = { order: 'order:foreign' };
    const query = vi.fn(async (sql: string) => {
      if (sql === 'begin' || sql === 'rollback') return result([]);
      if (sql.includes('join runtime.outbox')) return result([{ scope_id: 'mall:event', occurred_at: '2026-08-29T01:00:00.000Z', payload }]);
      if (sql.includes('from ordering.orderrecord orders')) return result([orderFact({ scope_id: 'mall:other' })]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await expect(new ProcessReferralEvent(pool).execute({ eventId: 'event:foreign', event: 'order.placed' })).rejects.toThrow('REFERRAL_ORDER_EVIDENCE_MISMATCH');
    expect(query).toHaveBeenCalledWith('rollback');
    expect(query.mock.calls.some(([sql]) => sql.includes('update runtime.inbox'))).toBe(false);
  });

  it('moves only matching commissions to settling and schedules their configured delay', async () => {
    const payload = { order: 'order:paid' };
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql.includes('update runtime.inbox')) return result([]);
      if (sql.includes('join runtime.outbox')) return result([{ scope_id: 'mall:one', occurred_at: '2026-08-29T02:00:00.000Z', payload }]);
      if (sql.includes("inbox.event_type='order.placed'")) return result([{ ready: 1 }]);
      if (sql.includes('from ordering.orderrecord orders')) return result([orderFact({ payment_state: 'paid' })]);
      if (sql.includes("update referral.commission set state='settling'")) {
        expect(values?.[3]).toBe('on_paid');
        return result([{ eligible_at: '2026-08-31T02:00:00.000Z' }]);
      }
      if (sql.includes('insert into runtime.job')) {
        expect(values?.slice(1)).toEqual(['mall:one', '2026-08-31T02:00:00.000Z']);
        return result([]);
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await new ProcessReferralEvent(pool).execute({ eventId: 'event:paid', event: 'order.paid' });
  });

  it('keeps cancellation history and fully reverses a pending commission without a finance post', async () => {
    const payload = { order: 'order:cancelled' };
    let reversedBase = '0';
    let reversed = '0';
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql.includes('update runtime.inbox')) return result([]);
      if (sql.includes('join runtime.outbox')) return result([{ scope_id: 'mall:one', occurred_at: '2026-08-29T03:00:00.000Z', payload }]);
      if (sql.includes("inbox.event_type='order.placed'")) return result([{ ready: 1 }]);
      if (sql.includes('from ordering.orderrecord orders')) return result([orderFact({ lifecycle_state: 'cancelled' })]);
      if (sql.includes('select distinct beneficiary_member_id')) return result([{ beneficiary_member_id: 'member:direct' }]);
      if (sql.includes('from referral.member where scope_id') && sql.includes('for update')) return result([{ member_id: 'member:direct' }]);
      if (sql.includes('from referral.commission where scope_id')) return result([commissionFact()]);
      if (sql.includes('insert into referral.commissionmovement')) {
        reversedBase = String(values?.[6]);
        reversed = String(values?.[7]);
        return result([]);
      }
      if (sql.includes('from referral.commission where id=$1')) {
        return result([{ reversed_base_minor: reversedBase, reversed_minor: reversed, state: 'reversed' }]);
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await new ProcessReferralEvent(pool).execute({ eventId: 'event:cancelled', event: 'order.cancelled' });

    expect([reversedBase, reversed]).toEqual(['1000', '50']);
    expect(query.mock.calls.some(([sql]) => sql.includes('select finance.post'))).toBe(false);
  });

  it('posts a balanced payable reversal before reversing a settled commission', async () => {
    const payload = { order: 'order:cancelled' };
    let journal: unknown;
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql.includes('update runtime.inbox')) return result([]);
      if (sql.includes('join runtime.outbox')) return result([{ scope_id: 'mall:one', occurred_at: '2026-08-29T03:30:00.000Z', payload }]);
      if (sql.includes("inbox.event_type='order.placed'")) return result([{ ready: 1 }]);
      if (sql.includes('from ordering.orderrecord orders')) return result([orderFact({ lifecycle_state: 'cancelled' })]);
      if (sql.includes('select distinct beneficiary_member_id')) return result([{ beneficiary_member_id: 'member:direct' }]);
      if (sql.includes('from referral.member where scope_id') && sql.includes('for update')) return result([{ member_id: 'member:direct' }]);
      if (sql.includes('from referral.commission where scope_id')) return result([commissionFact({ state: 'settled' })]);
      if (sql.includes("update finance.withdrawal withdrawal set state='cancelled'")) return result([]);
      if (sql.includes("withdrawal.state in('processing','uncertain')")) return result([]);
      if (sql.includes("claim.state='paid'")) return result([{ consumed_minor: '0' }]);
      if (sql.includes('select finance.post')) return result([{ journal: 'journal:reversal' }]);
      if (sql.includes('insert into referral.commissionmovement')) {
        journal = values?.[8];
        return result([]);
      }
      if (sql.includes('from referral.commission where id=$1')) {
        return result([{ reversed_base_minor: '1000', reversed_minor: '50', state: 'reversed' }]);
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await new ProcessReferralEvent(pool).execute({ eventId: 'event:settled-cancelled', event: 'order.cancelled' });

    const post = query.mock.calls.find(([sql]) => sql.includes('select finance.post'));
    expect(post?.[1]?.slice(0, 2)).toEqual(['mall:one', 'referral.commission.reversed']);
    expect(post?.[1]?.slice(5, 10)).toEqual(['referral.commission.payable.member:direct', 'liability', 'referral.commission.expense', 'expense', 50]);
    expect(journal).toBe('journal:reversal');
  });

  it('cancels unpaid claims and reclassifies an already paid reversal as a recovery receivable', async () => {
    const payload = { order: 'order:cancelled' };
    let recoveryMovement: readonly unknown[] | undefined;
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql.includes('update runtime.inbox')) return result([]);
      if (sql.includes('join runtime.outbox')) {
        return result([{ scope_id: 'mall:one', occurred_at: '2026-08-29T03:45:00.000Z', payload }]);
      }
      if (sql.includes("inbox.event_type='order.placed'")) return result([{ ready: 1 }]);
      if (sql.includes('from ordering.orderrecord orders')) return result([orderFact({ lifecycle_state: 'cancelled' })]);
      if (sql.includes('select distinct beneficiary_member_id')) return result([{ beneficiary_member_id: 'member:direct' }]);
      if (sql.includes('from referral.member where scope_id') && sql.includes('for update')) return result([{ member_id: 'member:direct' }]);
      if (sql.includes('from referral.commission where scope_id')) return result([commissionFact({ state: 'settled' })]);
      if (sql.includes("update finance.withdrawal withdrawal set state='cancelled'")) return result([{ id: 'withdrawal:unpaid' }]);
      if (sql.includes("withdrawal.state in('processing','uncertain')")) return result([]);
      if (sql.includes("claim.state='paid'")) return result([{ consumed_minor: '50' }]);
      if (sql.includes('select finance.post')) {
        return result([{ journal: values?.[1] === 'referral.commission.reversed' ? 'journal:reversal' : 'journal:recovery' }]);
      }
      if (sql.includes('insert into referral.commissionmovement')) return result([]);
      if (sql.includes('insert into referral.recoverymovement')) {
        recoveryMovement = values;
        return result([]);
      }
      if (sql.includes('from referral.commission where id=$1')) {
        return result([{ reversed_base_minor: '1000', reversed_minor: '50', state: 'reversed' }]);
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await new ProcessReferralEvent(pool).execute({ eventId: 'event:paid-claim-cancelled', event: 'order.cancelled' });

    const posts = query.mock.calls.filter(([sql]) => sql.includes('select finance.post'));
    expect(posts.map(([, values]) => values?.[1])).toEqual(['referral.commission.reversed', 'referral.commission.recovery.accrued']);
    expect(posts[1]?.[1]?.slice(5, 10)).toEqual(['referral.commission.receivable.member:direct', 'asset', 'referral.commission.payable.member:direct', 'liability', 50]);
    expect(recoveryMovement?.slice(3, 9)).toEqual(['commission:one', expect.stringMatching(/^movement:/), 'event:paid-claim-cancelled', 'CNY', 50, 'journal:recovery']);
  });

  it('re-accrues receivable when a commission that funded a prior recovery offset is later reversed', async () => {
    const payload = { order: 'order:cancelled' };
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql.includes('update runtime.inbox')) return result([]);
      if (sql.includes('join runtime.outbox')) {
        return result([{ scope_id: 'mall:one', occurred_at: '2026-08-29T03:50:00.000Z', payload }]);
      }
      if (sql.includes("inbox.event_type='order.placed'")) return result([{ ready: 1 }]);
      if (sql.includes('from ordering.orderrecord orders')) return result([orderFact({ lifecycle_state: 'cancelled' })]);
      if (sql.includes('select distinct beneficiary_member_id')) return result([{ beneficiary_member_id: 'member:direct' }]);
      if (sql.includes('from referral.member where scope_id') && sql.includes('for update')) return result([{ member_id: 'member:direct' }]);
      if (sql.includes('from referral.commission where scope_id')) {
        return result([commissionFact({ state: 'settled', rate_bps: 1000, amount_minor: '100' })]);
      }
      if (sql.includes("update finance.withdrawal withdrawal set state='cancelled'")) return result([]);
      if (sql.includes("withdrawal.state in('processing','uncertain')")) return result([]);
      if (sql.includes("claim.state='paid'")) {
        expect(sql).toContain("movement.kind='offset'");
        expect(sql).toContain('movement.settlement_commission_id=$2');
        return result([{ consumed_minor: '30' }]);
      }
      if (sql.includes('select finance.post')) {
        return result([{ journal: values?.[1] === 'referral.commission.reversed' ? 'journal:reversal' : 'journal:recovery' }]);
      }
      if (sql.includes('insert into referral.commissionmovement')) return result([]);
      if (sql.includes('insert into referral.recoverymovement')) {
        expect(values?.[7]).toBe(30);
        return result([]);
      }
      if (sql.includes('from referral.commission where id=$1')) {
        return result([{ reversed_base_minor: '1000', reversed_minor: '100', state: 'reversed' }]);
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await new ProcessReferralEvent(pool).execute({ eventId: 'event:offset-funded-cancelled', event: 'order.cancelled' });

    const posts = query.mock.calls.filter(([sql]) => sql.includes('select finance.post'));
    expect(posts.map(([, values]) => [values?.[1], values?.[9]])).toEqual([
      ['referral.commission.reversed', 100],
      ['referral.commission.recovery.accrued', 30],
    ]);
  });

  it('uses cumulative successful refunds for partial and then full reversal', async () => {
    let run = 0;
    let reversedBase = '0';
    let reversed = '0';
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql.includes('update runtime.inbox')) return result([]);
      if (sql.includes('join runtime.outbox')) {
        run += 1;
        return result([{ scope_id: 'mall:one', occurred_at: `2026-08-29T0${run + 3}:00:00.000Z`, payload: { refund: `refund:${run}`, order: 'order:one' } }]);
      }
      if (sql.includes("inbox.event_type='order.placed'")) return result([{ ready: 1 }]);
      if (sql.includes('select refund.id,intent.order_id')) return result([{ id: `refund:${run}`, order_id: 'order:one', scope_id: 'mall:one', state: 'succeeded' }]);
      if (sql.includes('from ordering.orderrecord orders')) return result([orderFact()]);
      if (sql.includes('from ordering.line where')) return result([{ id: 'line:one', payable_minor: '1000' }]);
      if (sql.includes('group by refund.id')) {
        const amount = run === 1 ? '100' : '1000';
        return result([{ id: `refund:${run}`, line_id: 'line:one', refund_minor: amount, tender_minor: amount, included_minor: amount }]);
      }
      if (sql.includes('select distinct beneficiary_member_id')) return result([{ beneficiary_member_id: 'member:direct' }]);
      if (sql.includes('from referral.member where scope_id') && sql.includes('for update')) return result([{ member_id: 'member:direct' }]);
      if (sql.includes('from referral.commission where scope_id')) return result([commissionFact({ reversed_base_minor: reversedBase, reversed_minor: reversed })]);
      if (sql.includes('insert into referral.commissionmovement')) {
        reversedBase = String(BigInt(reversedBase) + BigInt(String(values?.[6])));
        reversed = String(BigInt(reversed) + BigInt(String(values?.[7])));
        return result([]);
      }
      if (sql.includes('from referral.commission where id=$1')) {
        return result([{ reversed_base_minor: reversedBase, reversed_minor: reversed, state: run === 1 ? 'pending' : 'reversed' }]);
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;
    const processor = new ProcessReferralEvent(pool);

    await processor.execute({ eventId: 'event:refund:one', event: 'payment.refunded' });
    expect(reversedBase).toBe('100');
    expect(reversed).toBe('5');
    await processor.execute({ eventId: 'event:refund:two', event: 'payment.refunded' });
    expect(reversedBase).toBe('1000');
    expect(reversed).toBe('50');
  });

  it('leaves an event pending when one claim is in flight even if another approved claim was cancellable', async () => {
    const payload = { order: 'order:cancelled' };
    const query = vi.fn(async (sql: string) => {
      if (sql === 'begin' || sql === 'rollback') return result([]);
      if (sql.includes('join runtime.outbox')) return result([{ scope_id: 'mall:one', occurred_at: '2026-08-29T06:00:00.000Z', payload }]);
      if (sql.includes("inbox.event_type='order.placed'")) return result([{ ready: 1 }]);
      if (sql.includes('from ordering.orderrecord orders')) return result([orderFact({ lifecycle_state: 'cancelled' })]);
      if (sql.includes('select distinct beneficiary_member_id')) return result([{ beneficiary_member_id: 'member:direct' }]);
      if (sql.includes('from referral.member where scope_id') && sql.includes('for update')) return result([{ member_id: 'member:direct' }]);
      if (sql.includes('from referral.commission where scope_id')) return result([commissionFact({ state: 'settled' })]);
      if (sql.includes("update finance.withdrawal withdrawal set state='cancelled'")) return result([{ id: 'withdrawal:approved' }]);
      if (sql.includes("withdrawal.state in('processing','uncertain')")) return result([{ id: 'withdrawal:processing' }]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await expect(new ProcessReferralEvent(pool).execute({ eventId: 'event:in-flight-refund', event: 'order.cancelled' })).rejects.toThrow('REFERRAL_REVERSAL_WITHDRAWAL_IN_FLIGHT');
    expect(query.mock.calls.some(([sql]) => sql.includes("state='cancelled'"))).toBe(true);
    expect(query).toHaveBeenCalledWith('rollback');
    expect(query.mock.calls.some(([sql]) => sql.includes('update runtime.inbox'))).toBe(false);
  });

  it('retries a downstream event until the order.placed referral transaction has committed', async () => {
    const payload = { order: 'order:paid' };
    const query = vi.fn(async (sql: string) => {
      if (sql === 'begin' || sql === 'rollback') return result([]);
      if (sql.includes('join runtime.outbox')) {
        return result([{ scope_id: 'mall:one', occurred_at: '2026-08-29T02:00:00.000Z', payload }]);
      }
      if (sql.includes("inbox.event_type='order.placed'")) return result([]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await expect(new ProcessReferralEvent(pool).execute({ eventId: 'event:paid-before-placed', event: 'order.paid' })).rejects.toThrow('REFERRAL_ORDER_PLACED_NOT_PROCESSED');

    expect(query).toHaveBeenCalledWith('rollback');
    expect(query.mock.calls.some(([sql]) => sql.includes('update runtime.inbox'))).toBe(false);
  });
});

function orderFact(overrides: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return {
    id: 'order:one',
    scope_id: 'mall:one',
    member_id: 'member:buyer',
    currency: 'CNY',
    total_minor: '1000',
    benefit_minor: '0',
    payment_state: 'unpaid',
    fulfillment_state: 'unallocated',
    lifecycle_state: 'active',
    created_at: '2026-08-29T00:00:00.000Z',
    ...overrides,
  };
}

function commissionFact(overrides: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return {
    id: 'commission:one',
    scope_id: 'mall:one',
    order_line_id: 'line:one',
    beneficiary_member_id: 'member:direct',
    base_minor: '1000',
    rate_bps: 500,
    amount_minor: '50',
    reversed_base_minor: '0',
    reversed_minor: '0',
    currency: 'CNY',
    state: 'pending',
    ...overrides,
  };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
