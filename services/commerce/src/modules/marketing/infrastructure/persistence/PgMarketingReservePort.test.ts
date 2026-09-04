import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { result } from '../../../../test/TransactionFixture';
import { PgMarketingReservePort } from './PgMarketingReservePort';

const context = { trace: 'trace:marketing' } as WriteTransactionContext;
const input = {
  campaign: 'campaign:one',
  campaignVersion: 7,
  member: 'member:one',
  order: 'order:one',
  scope: 'mall:one',
  amountMinor: 500,
  expiresAt: '2030-09-05T08:15:00.000Z',
} as const;

describe('PgMarketingReservePort', () => {
  it('reserves once with campaign-version CAS, available-budget guard and expiry scheduling', async () => {
    const query = vi.fn(async (text: string, _values?: readonly unknown[]) => {
      if (text.startsWith('insert into marketing.redemption')) return result([reservation()]);
      if (text.startsWith('update marketing.campaign set spent_minor')) return result([{ budget_minor: 10_000, spent_minor: 1_500, budget_version: 5 }]);
      if (text.includes('select exists(select 1 from runtime.jobs')) return result([{ existing: false, depth: 0 }]);
      return result([]);
    });
    await new PgMarketingReservePort(access(query)).reserve(context, input);
    const budgetSql = String(query.mock.calls.find(([text]) => String(text).startsWith('update marketing.campaign set spent_minor'))?.[0]);
    expect(budgetSql).toContain('version=$4');
    expect(budgetSql).toContain('budget_minor-spent_minor>=$3');
    expect(query.mock.calls.some(([text]) => String(text).includes('runtime.job'))).toBe(true);
    expect(query.mock.calls.some(([_text, values]) => String(values).includes('marketing.promotion.reserved'))).toBe(true);
  });

  it('rejects a losing concurrent reservation without interpreting a stale budget snapshot', async () => {
    const query = vi.fn(async (text: string, _values?: readonly unknown[]) => (text.startsWith('insert into marketing.redemption') ? result([reservation()]) : result([])));
    await expect(new PgMarketingReservePort(access(query)).reserve(context, input)).rejects.toThrow('MARKETING_BUDGET_CONFLICT');
    expect(query.mock.calls.some(([text]) => String(text).includes('runtime.job'))).toBe(false);
  });

  it('expires only due reservations, replenishes the campaign and emits release evidence', async () => {
    const query = vi.fn(async (text: string, _values?: readonly unknown[]) => {
      if (text.startsWith("update marketing.redemption redemption set state='released'")) return result([reservation({ state: 'released', version: 2 })]);
      if (text.startsWith('with amounts as')) return result([{ id: 'campaign:one' }]);
      return result([]);
    });
    await new PgMarketingReservePort(access(query)).expire(context, 'order:one', new Date('2030-09-05T08:15:00.000Z'));
    const release = query.mock.calls.find(([text]) => String(text).includes("state='released'"));
    expect(String(release?.[0])).toContain('redemption.expires_at<=$2');
    expect(query.mock.calls.some(([_text, values]) => String(values).includes('marketing.promotion.released'))).toBe(true);
  });

  it('replenishes only the cumulative proportional delta and finishes on a full refund', async () => {
    const query = vi.fn(async (text: string, _values?: readonly unknown[]) => {
      if (text.startsWith('select redemption.id')) return result([reservation({ state: 'committed', restored_minor: 200, version: 2 })]);
      if (text.startsWith('with amounts as')) return result([{ id: 'campaign:one' }]);
      return result([]);
    });
    await new PgMarketingReservePort(access(query)).refund(context, { refund: 'refund:one', order: 'order:one', refundedMinor: 1_000, capturedMinor: 1_000 });
    const update = query.mock.calls.find(([text]) => String(text).startsWith('update marketing.redemption target'));
    expect(String(update?.[1])).toContain('"restored":500');
    expect(String(update?.[1])).toContain('"state":"refunded"');
    const replenishment = query.mock.calls.find(([text]) => String(text).startsWith('with amounts as'));
    expect(String(replenishment?.[1])).toContain('"amount":300');
  });
});

function reservation(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: 'promotion:one',
    campaign_id: 'campaign:one',
    member_id: 'member:one',
    order_id: 'order:one',
    amount_minor: 500,
    restored_minor: 0,
    state: 'reserved',
    campaign_version: 7,
    expires_at: new Date(input.expiresAt),
    version: 1,
    scope_id: 'mall:one',
    ...overrides,
  };
}

function access(query: ReturnType<typeof vi.fn>): PgTransactionAccess {
  return { database: () => ({ query }) as unknown as SqlExecutor } as unknown as PgTransactionAccess;
}
