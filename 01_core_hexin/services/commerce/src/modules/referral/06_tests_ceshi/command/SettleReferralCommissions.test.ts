import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { SettleReferralCommissions } from '../../03_application_yingyong/command/SettleReferralCommissions';

describe('SettleReferralCommissions', () => {
  it('posts only the non-reversed amount and makes retry a no-op', async () => {
    let pending = true;
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return result([]);
      if (sql.includes('select member.member_id from referral.member')) {
        return result(pending ? [{ member_id: 'member:one' }] : []);
      }
      if (sql.includes("from referral.commission where scope_id=$1 and state='settling'")) {
        return result(
          pending
            ? [{ id: 'commission:one', scope_id: 'mall:one', beneficiary_member_id: 'member:one', origin_event_id: 'event:placed', currency: 'CNY', amount_minor: '50', reversed_minor: '5', eligible_at: '2026-08-29T01:00:00.000Z' }]
            : []
        );
      }
      if (sql.includes('from referral.recoverymovement recovery')) return result([]);
      if (sql.includes('select finance.post')) return result([{ journal: 'journal:one' }]);
      if (sql.includes("update referral.commission set state='settled'")) {
        pending = false;
        return result([{ id: 'commission:one' }]);
      }
      if (sql.includes('select min(eligible_at)')) return result([]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;
    const settlement = new SettleReferralCommissions(pool);

    await settlement.execute('mall:one');
    await settlement.execute('mall:one');

    const posts = query.mock.calls.filter(([sql]) => sql.includes('select finance.post'));
    expect(posts).toHaveLength(1);
    expect(posts[0]?.[1]).toEqual([
      'mall:one',
      'referral.commission.accrued',
      'commission:one',
      'CNY',
      'Referral commission accrual',
      'referral.commission.expense',
      'expense',
      'referral.commission.payable.member:one',
      'liability',
      45,
      '2026-08-29T01:00:00.000Z',
    ]);
    expect(query.mock.calls.filter(([sql]) => sql.includes('insert into referral.commissionmovement'))).toHaveLength(0);
    expect(query.mock.calls.filter(([sql]) => sql === 'commit')).toHaveLength(2);
  });

  it('offsets future payable against recovery accruals oldest-first and persists every balanced offset', async () => {
    const movements: readonly (readonly unknown[])[] = [];
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql === 'begin' || sql === 'commit' || sql === 'rollback') return result([]);
      if (sql.includes('select member.member_id from referral.member')) return result([{ member_id: 'member:one' }]);
      if (sql.includes("from referral.commission where scope_id=$1 and state='settling'")) {
        return result([
          {
            id: 'commission:future',
            scope_id: 'mall:one',
            beneficiary_member_id: 'member:one',
            origin_event_id: 'event:future-placed',
            currency: 'CNY',
            amount_minor: '50',
            reversed_minor: '5',
            eligible_at: '2026-08-29T01:00:00.000Z',
          },
        ]);
      }
      if (sql.includes('from referral.recoverymovement recovery')) {
        return result([
          { id: 'recovery:old', source_commission_id: 'commission:old', amount_minor: '30', outstanding_minor: '30' },
          { id: 'recovery:new', source_commission_id: 'commission:new', amount_minor: '40', outstanding_minor: '40' },
        ]);
      }
      if (sql.includes('select finance.post')) {
        const referenceType = values?.[1];
        return result([{ journal: referenceType === 'referral.commission.accrued' ? 'journal:accrual' : `journal:offset:${String(values?.[2])}` }]);
      }
      if (sql.includes('insert into referral.recoverymovement')) {
        (movements as unknown[][]).push(values as unknown[]);
        return result([]);
      }
      if (sql.includes("update referral.commission set state='settled'")) return result([{ id: 'commission:future' }]);
      if (sql.includes('select min(eligible_at)')) return result([]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = { query: vi.fn(), connect: vi.fn(async () => client) } as unknown as DatabasePool;

    await new SettleReferralCommissions(pool).execute('mall:one');

    const posts = query.mock.calls.filter(([sql]) => sql.includes('select finance.post'));
    expect(posts.map(([, values]) => [values?.[1], values?.[9]])).toEqual([
      ['referral.commission.accrued', 45],
      ['referral.commission.recovery.offset', 30],
      ['referral.commission.recovery.offset', 15],
    ]);
    expect(movements.map((values) => [values[3], values[4], values[5], values[8]])).toEqual([
      ['commission:old', 'commission:future', 'recovery:old', 30],
      ['commission:new', 'commission:future', 'recovery:new', 15],
    ]);
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
