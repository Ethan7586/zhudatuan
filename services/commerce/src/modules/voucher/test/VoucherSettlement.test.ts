import { describe, expect, it, vi } from 'vitest';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';
import { VoucherRedemptionWriter } from '../infrastructure/persistence/VoucherRedemptionWriter';
import { VoucherRefundWriter } from '../infrastructure/persistence/VoucherRefundWriter';
import type { OrganizationReadPort } from '../../organization/public';

const organizations: Pick<OrganizationReadPort, 'scope'> = { scope: async (_context, id) => ({ id, scopeKind: 'mall', timezone: 'Asia/Shanghai', tenant: 'scope:root', ancestors: ['scope:root'], descendants: [] }) };

const now = new Date('2026-09-05T00:00:00.000Z');
const source = {
  id: 'voucher:one',
  credential_id: 'credential:one',
  product_id: 'product:one',
  holder_id: 'holder:one',
  initial_minor: 1000,
  remaining_minor: 1000,
  currency: 'CNY',
  state: 'active',
  starts_at: new Date(now.getTime() - 60_000),
  expires_at: new Date(now.getTime() + 60_000),
  version: 3,
};

describe('voucher settlement transaction', () => {
  it('atomically redeems a verified voucher, records history and posts once', async () => {
    const post = vi.fn(async () => 'journal:one');
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql.includes('from voucher.voucher voucher') && sql.includes('for update of voucher')) return result([source]);
      if (sql.includes('where redemption.id=$1')) return result([{ id: 'redemption:one', amountMinor: 400 }]);
      return result([]);
    });
    await withWriteTransaction(query, (context) =>
      new VoucherRedemptionWriter({ post }, organizations).redeem({
        context,
        scope: 'mall:one',
        voucher: source.id,
        hold: null,
        verification: 'verification:one',
        order: null,
        amountMinor: 400,
        idempotency: 'redeem:one',
        actor: 'actor:one',
        now,
      })
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining('remaining_minor=$3'), [source.id, 'mall:one', 600, 'active', 4]);
    expect(query.mock.calls.some(([sql]) => sql.includes('insert into voucher.timeline'))).toBe(true);
    expect(post).toHaveBeenCalledExactlyOnceWith(expect.anything(), expect.objectContaining({ amountMinor: 400, debit: { code: 'voucher.product.product:one', kind: 'liability' }, credit: { code: 'commerce.clearing', kind: 'income' } }));
  });

  it.each([
    ['expired', { state: 'active', expires_at: now, amount_minor: 400, owner_id: 'order:one' }, 'VOUCHER_HOLD_EXPIRED'],
    ['consumed', { state: 'consumed', expires_at: new Date(now.getTime() + 1000), amount_minor: 400, owner_id: 'order:one' }, 'VOUCHER_HOLD_CONFLICT'],
    ['different order', { state: 'active', expires_at: new Date(now.getTime() + 1000), amount_minor: 400, owner_id: 'order:other' }, 'VOUCHER_REDEMPTION_CONFLICT'],
    ['different amount', { state: 'active', expires_at: new Date(now.getTime() + 1000), amount_minor: 500, owner_id: 'order:one' }, 'VOUCHER_REDEMPTION_CONFLICT'],
  ])('rejects a %s hold before posting', async (_label, hold, code) => {
    const post = vi.fn(async () => 'journal:one');
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from voucher.voucher voucher') && sql.includes('for update of voucher')) return result([{ ...source, state: 'held' }]);
      if (sql.includes('from voucher.tenderhold hold') && sql.includes('for update')) return result([{ id: 'hold:one', ...hold }]);
      return result([]);
    });
    await expect(
      withWriteTransaction(query, (context) =>
        new VoucherRedemptionWriter({ post }, organizations).redeem({
          context,
          scope: 'mall:one',
          voucher: source.id,
          hold: 'hold:one',
          verification: 'verification:one',
          order: 'order:one',
          amountMinor: 400,
          idempotency: 'redeem:one',
          actor: 'actor:one',
          now,
        })
      )
    ).rejects.toThrow(code);
    expect(post).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => sql.startsWith('update '))).toBe(false);
  });

  it('replays the same redemption without debiting twice', async () => {
    const post = vi.fn(async () => 'journal:one');
    const query = vi.fn(async () => result([{ id: 'redemption:one', voucher: source.id, hold: 'hold:one', order: 'order:one', amountMinor: 400, verification: 'verification:one' }]));
    await withWriteTransaction(query, (context) =>
      new VoucherRedemptionWriter({ post }, organizations).redeem({
        context,
        scope: 'mall:one',
        voucher: source.id,
        hold: 'hold:one',
        verification: 'verification:one',
        order: 'order:one',
        amountMinor: 400,
        idempotency: 'redeem:one',
        actor: 'actor:one',
        now,
      })
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it('validates cumulative refunds before restoring value and reverses the original account types', async () => {
    const post = vi.fn(async () => 'journal:refund');
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      if (sql.startsWith('select voucher_id from voucher.redemption')) return result([{ voucher_id: source.id }]);
      if (sql.includes('for update of redemption'))
        return result([
          {
            ...source,
            voucher_id: source.id,
            voucher_state: 'active',
            remaining_minor: 700,
            amount_minor: 400,
            refunded_minor: 100,
            hold_id: null,
            verification_id: 'verification:one',
            channel: 'manual',
            store: null,
            order_id: null,
            scopes: ['mall:one', 'scope:root'],
            timezone: 'Asia/Shanghai',
            redemption_state: 'partiallyrefunded',
            redemption_version: 2,
          },
        ]);
      if (sql.includes('voucher.create_refund')) return result([{ id: values?.[0] }]);
      if (sql.startsWith('update voucher.voucher')) return result([{ id: source.id }]);
      return result([]);
    });
    await withWriteTransaction(query, (context) =>
      new VoucherRefundWriter({ post }).refund({ context, scope: 'mall:one', redemption: 'redemption:one', amountMinor: 300, reason: '退款返还', idempotency: 'refund:one', actor: 'actor:one', now })
    );
    expect(post).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amountMinor: 300, debit: { code: 'commerce.clearing', kind: 'income' }, credit: { code: 'voucher.product.product:one', kind: 'liability' } }));
    post.mockClear();
    await expect(
      withWriteTransaction(query, (context) =>
        new VoucherRefundWriter({ post }).refund({ context, scope: 'mall:one', redemption: 'redemption:one', amountMinor: 301, reason: '退款返还', idempotency: 'refund:over', actor: 'actor:one', now })
      )
    ).rejects.toThrow('VOUCHER_REFUND_EXCEEDS_REDEMPTION');
    expect(post).not.toHaveBeenCalled();
  });
});
