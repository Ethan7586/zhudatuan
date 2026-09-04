import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { ClaimedJob } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { PayoutGateway } from '../../03_application_yingyong/port/PayoutGateway';
import { SettlementJobProcessor } from '../../05_interface_jieru/job/SettlementJob';

describe('SettlementJobProcessor referral withdrawal', () => {
  it('pays a referral withdrawal without requiring a settlement and clears the member payable', async () => {
    const connectionQuery = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return result([]);
      if (sql.includes('from finance.withdrawal withdrawal left join finance.settlement')) {
        return result([
          {
            scope_id: 'mall:one',
            settlement_id: null,
            source_kind: 'referral',
            source_id: 'referral-member:self',
            beneficiary_member_id: 'member:self',
            partner_id: null,
            amount_minor: 880,
            currency: 'CNY',
          },
        ]);
      }
      if (sql.includes('select finance.post')) return result([{ journal: 'journal:referral-withdrawal' }]);
      if (sql.includes("update finance.withdrawal set state='paid'")) return result([{ id: 'withdrawal:referral' }]);
      if (sql.includes('insert into runtime.outbox')) return result([]);
      throw new Error(`UNEXPECTED_CONNECTION_QUERY:${sql}`);
    });
    const poolQuery = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql.includes("set state='processing'")) {
        return result([
          {
            id: 'withdrawal:referral',
            destination_ref: 'wallet:verified',
            amount_minor: 880,
            currency: 'CNY',
          },
        ]);
      }
      throw new Error(`UNEXPECTED_POOL_QUERY:${sql}`);
    });
    const connection = { query: connectionQuery, release: vi.fn() };
    const pool = {
      query: poolQuery,
      connect: vi.fn(async () => connection),
      workload: vi.fn(),
      end: vi.fn(),
    } as unknown as DatabasePool;
    const payouts: PayoutGateway = {
      submit: vi.fn(async () => ({ reference: 'payout:referral', state: 'paid' as const })),
    };
    const processor = new SettlementJobProcessor(pool, payouts);

    await processor.process(
      {
        id: 'job:withdrawal:referral',
        kind: 'settlement',
        scope_id: 'mall:one',
        payload: { withdrawal: 'withdrawal:referral' },
        attempts: 1,
      } as ClaimedJob,
      new AbortController().signal
    );

    expect(payouts.submit).toHaveBeenCalledWith({
      withdrawal: 'withdrawal:referral',
      destination: 'wallet:verified',
      amountMinor: 880,
      currency: 'CNY',
    });
    const posting = connectionQuery.mock.calls.find(([sql]) => String(sql).includes('select finance.post'));
    expect(posting?.[1]).toEqual([
      'mall:one',
      'referral.withdrawal.paid',
      'withdrawal:referral',
      'CNY',
      'Referral commission payout',
      'referral.commission.payable.member:self',
      'liability',
      'cash',
      'asset',
      880,
      expect.any(String),
    ]);
    const sql = connectionQuery.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).not.toContain('update finance.settlement settlement');
    expect(sql).not.toContain('finance.mark_partner_settlement_split_paid');
    const outbox = connectionQuery.mock.calls.find(([statement]) => String(statement).includes('insert into runtime.outbox'));
    expect(outbox?.[1]).toEqual([
      'event:finance:withdrawal:withdrawal:referral',
      'withdrawal:referral',
      'mall:one',
      null,
      'referral',
      'referral-member:self',
      'member:self',
      880,
      'CNY',
    ]);
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
