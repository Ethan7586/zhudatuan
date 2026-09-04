import { describe, expect, it, vi } from 'vitest';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';
import { VoucherPort } from '../infrastructure/persistence/VoucherPort';

const input = Object.freeze({
  fulfillment: 'fulfillment:one',
  order: 'order:one',
  scope: 'mall:one',
  member: 'member:one',
  items: Object.freeze([{ line: 'line:one', product: 'product:voucher', sku: 'sku:voucher', quantity: 2 }]),
});

describe('FulfillmentVoucherPort', () => {
  it('atomically allocates active vouchers from the configured voucher product', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('event.reason=$1')) return result([]);
      if (sql.includes("voucher.state in('available','allocated')")) return result([
        { id: 'voucher:one', state: 'available', activation: 'automatic', version: 1 },
        { id: 'voucher:two', state: 'allocated', activation: 'automatic', version: 4 },
      ]);
      if (sql.includes('update voucher.voucher')) return result([{ id: 'changed' }]);
      return result([]);
    });
    const receipt = await withWriteTransaction(query, (context) => new VoucherPort().issue(context, input));
    expect(receipt).toEqual({ reference: 'voucherissue:fulfillment:one', vouchers: ['voucher:one', 'voucher:two'] });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("actor_id='system:fulfillment'"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('voucher.product_id=$1') && String(sql).includes('skip locked'))).toBe(true);
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('insert into voucher.holder'))).toHaveLength(2);
  });

  it('returns the original receipt without allocating twice', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return result([]);
      if (sql.includes('event.reason=$1')) return result([{ id: 'voucher:two' }, { id: 'voucher:one' }]);
      throw new Error('unexpected mutation');
    });
    const receipt = await withWriteTransaction(query, (context) => new VoucherPort().issue(context, input));
    expect(receipt.vouchers).toEqual(['voucher:one', 'voucher:two']);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('does not mark fulfillment successful when voucher stock is short', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('event.reason=$1')) return result([]);
      if (sql.includes("voucher.state in('available','allocated')")) return result([{ id: 'voucher:one', state: 'available', activation: 'automatic', version: 1 }]);
      return result([]);
    });
    await expect(withWriteTransaction(query, (context) => new VoucherPort().issue(context, input))).rejects.toThrow('VOUCHER_STOCK_INSUFFICIENT');
  });
});
