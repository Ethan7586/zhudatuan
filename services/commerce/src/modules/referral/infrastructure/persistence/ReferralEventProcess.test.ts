import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { pgTransactionState } from '../../../../adapter/database/PgTransactionState';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgReferralEventProcess } from './PgReferralEventProcess';
import { commissionableRefundAmount } from './ReferralEventCodec';

describe('Referral event persistence', () => {
  it('creates one direct commission and at most one inviter reward from one immutable rule snapshot', async () => {
    const inserts: readonly unknown[][] = [];
    const inserted: unknown[][] = [];
    const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('select inbox.event_id')) return result([inbox()]);
      if (sql.includes('from referral.setting')) return result([{ enabled: true, reward_enabled: true, settlement_trigger: 'paid', rate_basis_points: 500, currency: 'CNY', version: 4, freeze_days: 2 }]);
      if (sql.includes('from referral.binding binding')) return result([{ id: 'referralbinding:one', beneficiary_id: 'member:direct', inviter_beneficiary_id: 'member:inviter' }]);
      if (sql.includes('from referral.product')) return result([{ id: 'referralproduct:one', product_id: 'product:one', enabled: true, rate_basis_points: 800, reward_basis_points: 200, version: 3 }]);
      if (sql.includes('insert into referral.commission')) {
        inserted.push([...values]);
        return result([{ id: values[0], version: 1 }]);
      }
      if (sql.includes("rule_snapshot->>'settlementTrigger'='paid'")) return result([{ id: 'referralcommission:any' }], 2);
      if (sql.includes('select exists(select 1 from runtime.jobs')) return result([{ existing: false, depth: 0 }]);
      if (sql.includes('update runtime.inbox')) return result([], 1);
      return result([]);
    });
    const manager = {
      write: async (options: Readonly<Record<string, unknown>>, work: (context: WriteTransactionContext) => Promise<unknown>) => {
        const context = { id: 'transaction:one', mode: 'write', ...options } as unknown as WriteTransactionContext;
        return pgTransactionState.run({ client: { query } as unknown as PoolClient, context, mode: 'write', open: true }, () => work(context));
      },
    };
    const process = new PgReferralEventProcess(manager as never, { post: vi.fn() } as never, { read: vi.fn() } as never);
    await process.process({ eventId: 'event:paid', eventType: 'order.paid', scopeId: 'mall:one', sourceId: 'order:one', resourceId: 'order:one' }, new AbortController().signal, Date.now() + 10_000);

    expect(inserts).toHaveLength(0);
    expect(inserted).toHaveLength(2);
    expect(inserted.map((values) => ({ beneficiary: values[6], kind: values[7], amount: values[14], rate: values[15] }))).toEqual([
      { beneficiary: 'member:direct', kind: 'commission', amount: 720, rate: 800 },
      { beneficiary: 'member:inviter', kind: 'reward', amount: 180, rate: 200 },
    ]);
    const snapshots = inserted.map((values) => JSON.parse(String(values[11])) as Record<string, unknown>);
    expect(snapshots).toEqual([
      expect.objectContaining({ kind: 'commission', commissionBasisPoints: 800, rewardBasisPoints: 200, settlementTrigger: 'paid', freezeDays: 2, productVersion: 3, settingVersion: 4 }),
      expect.objectContaining({ kind: 'reward', commissionBasisPoints: 800, rewardBasisPoints: 200, settlementTrigger: 'paid', freezeDays: 2, productVersion: 3, settingVersion: 4 }),
    ]);
  });

  it('excludes refunded benefit tenders from commission reversal evidence', () => {
    expect(commissionableRefundAmount([{ kind: 'benefit', amount_minor: 200 }, { kind: 'wechat', amount_minor: 700 }, { kind: 'voucher', amount_minor: 100 }], 1_000)).toBe(800);
    expect(() => commissionableRefundAmount([{ kind: 'wechat', amount_minor: 700 }], 1_000)).toThrow('REFERRAL_REFUND_EVIDENCE_MISMATCH');
  });
});

function inbox() {
  return {
    id: 'event:paid',
    type: 'order.paid',
    version: 1,
    aggregate: 'order:one',
    scope: 'mall:one',
    occurredAt: '2026-09-05T08:00:00.000Z',
    payload: { member: 'member:buyer', currency: 'CNY', snapshot: { order: 'order:one', member: 'member:buyer', currency: 'CNY', totalMinor: 10_000, tenders: [{ kind: 'benefit', amountMinor: 1_000 }, { kind: 'wechat', amountMinor: 9_000 }], lines: [{ line: 'orderline:one', product: 'product:one', payableMinor: 10_000 }] } },
  };
}

function result<T>(rows: readonly T[], rowCount = rows.length): QueryResult<T & Record<string, unknown>> {
  return { rows: rows as (T & Record<string, unknown>)[], rowCount, command: '', oid: 0, fields: [] };
}
