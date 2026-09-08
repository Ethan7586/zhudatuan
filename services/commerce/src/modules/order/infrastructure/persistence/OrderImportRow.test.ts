import { describe, expect, it } from 'vitest';
import { orderImportValue } from './OrderImportRow';

const source = {
  source: 'jdproduct',
  externalOrderNo: 'JD-20260905-1',
  mall: 'mall:one',
  member: 'member:one',
  orderedAt: '2026-09-04T08:00:00.000Z',
  currency: 'CNY',
  state: 'paid',
  totalMinor: '1900',
  paymentReference: 'wx:one',
  sku: 'sku:one',
  listing: 'listing:one',
  title: '中秋福利礼盒',
  quantity: '2',
  unitMinor: '1000',
  discountMinor: '100',
  productType: 'physical',
  provider: 'jdproduct',
};

describe('order import row', () => {
  it('creates an immutable monetary and product snapshot', () => {
    expect(orderImportValue(source, Date.parse('2026-09-05T00:00:00.000Z'))).toMatchObject({
      source: 'jdproduct',
      externalOrderNo: 'JD-20260905-1',
      totalMinor: 1900,
      lines: [{ quantity: 2, unitMinor: 1000, totalMinor: 2000, discountMinor: 100, payableMinor: 1900 }],
    });
  });

  it('supports a bounded multi-line snapshot', () => {
    const value = orderImportValue(
      {
        ...source,
        totalMinor: '2500',
        lines: JSON.stringify([
          { sku: 'sku:one', listing: 'listing:one', title: '礼盒', quantity: 2, unitMinor: 1000, discountMinor: 100 },
          { sku: 'sku:two', listing: 'listing:two', title: '卡券', quantity: 1, unitMinor: 600, discountMinor: 0, productType: 'voucher' },
        ]),
      },
      Date.parse('2026-09-05T00:00:00.000Z')
    );
    expect(value.lines).toHaveLength(2);
    expect(value.lines.reduce((sum, line) => sum + line.payableMinor, 0)).toBe(2500);
  });

  it('keeps only a validated masked address snapshot and derives its integrity hash on the server', () => {
    const address = JSON.stringify({ recipientMasked: '王**', mobileMasked: '138****8000', addressMasked: '上海市浦东新区****路', regionCode: '310115', ignored: 'not persisted' });
    const value = orderImportValue({ ...source, address }, Date.parse('2026-09-05T00:00:00.000Z'));

    expect(value.address).toMatchObject({ recipientMasked: '王**', mobileMasked: '138****8000', addressMasked: '上海市浦东新区****路', regionCode: '310115', version: 'external:1' });
    expect(value.address?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(value.address).not.toHaveProperty('ignored');
    expect(() => orderImportValue({ ...source, address: JSON.stringify({ recipientMasked: '王明', mobileMasked: '13812345678', addressMasked: '上海市', regionCode: '310000' }) }, Date.parse('2026-09-05T00:00:00.000Z'))).toThrow(
      'ORDER_SNAPSHOT_INVALID'
    );
  });

  it.each([
    [{ ...source, source: 'unknown' }, 'ORDER_IMPORT_CHANNEL_INVALID'],
    [{ ...source, totalMinor: '1901' }, 'ORDER_IMPORT_AMOUNT_MISMATCH'],
    [{ ...source, orderedAt: '2027-01-01' }, 'ORDER_IMPORT_TIME_INVALID'],
    [{ ...source, quantity: '0' }, 'ORDER_IMPORT_QUANTITY_INVALID'],
  ])('rejects invalid source facts', (row, code) => {
    expect(() => orderImportValue(row, Date.parse('2026-09-05T00:00:00.000Z'))).toThrow(code);
  });
});
