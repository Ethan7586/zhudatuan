import { describe, expect, it } from 'vitest';
import { Reservation } from './model/Reservation';
import { StockItem, available } from './model/StockItem';
import { StockSource } from './model/StockSource';
import { ReservationPolicy } from './policy/ReservationPolicy';

const now = '2026-09-05T00:00:00.000Z';

describe('Inventory domain', () => {
  it('computes availability once as onhand minus active reservations and safety stock', () => {
    expect(available(10, 4, 2)).toBe(4);
    const stock = StockItem.create({ id: 'stock:one', scope: 'mall:one', sku: 'sku:one', location: 'warehouse:one', onhand: 10, safety: 2, state: 'active', updatedAt: now });
    expect(stock.available(4)).toBe(4);
    expect(() => stock.reserve(5, 4, now)).toThrow('INVENTORY_INSUFFICIENT');
    expect(stock.reserve(4, 4, now).snapshot().version).toBe(2);
  });

  it('treats the catalog SKU as an opaque foreign identity', () => {
    expect(
      StockItem.create({ id: 'stock:legacycatalog', scope: 'mall:one', sku: 'sku-rice-5kg', location: 'warehouse:one', onhand: 10, safety: 2, state: 'active', updatedAt: now }).snapshot().sku
    ).toBe('sku-rice-5kg');
    expect(() =>
      StockItem.create({ id: 'stock:invalidsku', scope: 'mall:one', sku: 'sku,invalid', location: 'warehouse:one', onhand: 10, safety: 2, state: 'active', updatedAt: now })
    ).toThrow('INVENTORY_BALANCE_INVALID');
  });

  it('makes reservation confirmation release and expiry mutually exclusive and idempotent', () => {
    const value = reservation();
    const committed = value.commit(new Date('2026-09-05T00:10:00.000Z'));
    expect(committed.commit(new Date('2026-09-05T00:20:00.000Z'))).toBe(committed);
    expect(() => committed.release()).toThrow('INVENTORY_RESERVATION_FINAL');
    const released = value.release();
    expect(released.release()).toBe(released);
    expect(() => released.commit(new Date('2026-09-05T00:10:00.000Z'))).toThrow('INVENTORY_RESERVATION_FINAL');
    const expired = value.expire(new Date('2026-09-05T00:30:00.000Z'));
    expect(expired.snapshot()).toMatchObject({ state: 'expired', version: 2 });
  });

  it('rejects payment confirmation at or after the reservation TTL', () => {
    expect(() => reservation().commit(new Date('2026-09-05T00:30:00.000Z'))).toThrow('INVENTORY_RESERVATION_FINAL');
    expect(() => reservation().expire(new Date('2026-09-05T00:29:59.999Z'))).toThrow('INVENTORY_RESERVATION_FINAL');
  });

  it('aggregates repeated lines and produces one deterministic stock lock order', () => {
    const result = new ReservationPolicy().demands([
      { sku: 'sku:two', listing: 'listing:two', stockitem: 'stock:two', quantity: 2, accepted: true },
      { sku: 'sku:one', listing: 'listing:one', stockitem: 'stock:one', quantity: 1, accepted: true },
      { sku: 'sku:two', listing: 'listing:other', stockitem: 'stock:two', quantity: 3, accepted: true },
      { sku: 'sku:ignored', listing: 'listing:ignored', stockitem: null, quantity: 1, accepted: false },
    ]);
    expect(result).toEqual([
      { sku: 'sku:one', listing: 'listing:one', stockitem: 'stock:one', quantity: 1 },
      { sku: 'sku:two', listing: 'listing:two', stockitem: 'stock:two', quantity: 5 },
    ]);
  });

  it('models provider source identity and rejects invalid source balances', () => {
    expect(StockSource.observe({ id: 'source:one', stockitem: 'stock:one', provider: 'jdproduct', reference: 'cursor:one', onhand: 8, observedAt: now }).snapshot()).toMatchObject({
      provider: 'jdproduct',
      onhand: 8,
      state: 'active',
      version: 1,
    });
    expect(() => StockSource.observe({ id: 'source:bad', stockitem: 'stock:one', provider: 'jdproduct', reference: 'cursor:one', onhand: -1, observedAt: now })).toThrow('INVENTORY_BALANCE_INVALID');
  });
});

function reservation() {
  return Reservation.reserve({ id: 'reservation:one', stockitem: 'stock:one', ownerKind: 'order', owner: 'order:one', quantity: 2, createdAt: now, expiresAt: '2026-09-05T00:30:00.000Z' });
}
