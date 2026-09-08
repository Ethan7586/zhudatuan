import { OPERATION_SCHEMAS } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { readHandlerContext } from '../../../test/HandlerFixture';
import { result, withReadTransaction } from '../../../test/TransactionFixture';
import { AvailabilityReadHandler } from '../application/handler/AvailabilityReadHandler';
import { PgInventoryReadPort } from '../infrastructure/persistence/PgInventoryReadPort';
import type { InventoryReadPort } from '../public/InventoryReadPort';

describe('inventory availability read', () => {
  it('defines a typed inventory import preview instead of a browser-owned estimate', () => {
    const parsed = OPERATION_SCHEMAS['inventory.imports.read'].output.parse({
      id: 'import:one',
      state: 'validated',
      total_count: 2,
      cursor_value: 2,
      success_count: 1,
      failure_count: 1,
      created_at: '2026-09-04T08:00:00.000Z',
      updated_at: '2026-09-04T08:01:00.000Z',
      validation_summary: {},
      last_error: null,
      errors: [],
      preview: {
        hash: 'a'.repeat(64),
        state: 'ready',
        total: 2,
        valid: 1,
        invalid: 1,
        onhandDelta: 10,
        samples: [{ row: 2, sku: 'sku:one', location: 'warehouse:one', source: 'jdproduct', onhand: 10, safety: 1, valid: true, issues: [] }],
        watermark: '2026-09-04T08:00:00.000Z',
        expiresAt: '2026-09-05T08:00:00.000Z',
      },
    });
    expect(parsed.preview).toMatchObject({ state: 'ready', valid: 1, invalid: 1 });
  });

  it('uses the authorized scope, source selector and latest authoritative watermark', async () => {
    const transaction = {} as ReadTransactionContext;
    const details = vi.fn(async () => [projection()]);
    const inventory: InventoryReadPort = { availability: async () => [], details };
    const reply = await new AvailabilityReadHandler(inventory).execute({ query: { sku: ['sku:one', 'sku:one'], source: 'jdproduct' } } as never, readHandlerContext('inventory.availability.read', transaction));
    expect(details).toHaveBeenCalledExactlyOnceWith(transaction, 'mall:one', ['sku:one'], 'jdproduct');
    expect(OPERATION_SCHEMAS['inventory.availability.read'].output.parse(reply.body)).toEqual(reply.body);
    expect(reply.body).toMatchObject({ count: 1, watermark: '2026-09-04T08:00:00.000Z', items: [{ available: 7, reserved: 2, safety: 1 }] });
  });

  it('computes available stock once from active sources and effective reservations', async () => {
    const projected = await withReadTransaction(
      async (text, values) => {
        expect(text).toContain("value.state='reserved'");
        expect(values).toEqual(['mall:one', ['sku:one'], null]);
        return result([
          row({ id: 'stock:one', location: 'warehouse:one', onhand: 10, safety: 1, reserved: 2, active_count: 1, version: '2' }),
          row({ id: 'stock:two', location: 'warehouse:two', onhand: 4, safety: 1, reserved: 1, active_count: 1, version: '3' }),
        ]);
      },
      (context) => new PgInventoryReadPort().details(context, 'mall:one', ['sku:one'], null)
    );
    expect(projected).toMatchObject([{ sku: 'sku:one', onhand: 14, safety: 2, reserved: 3, available: 9, state: 'available', reservation: { activeCount: 2, activeQuantity: 3 }, sources: [{ available: 7 }, { available: 2 }] }]);
  });
});

function projection() {
  return {
    sku: 'sku:one',
    scope: 'mall:one',
    onhand: 10,
    safety: 1,
    reserved: 2,
    available: 7,
    state: 'available' as const,
    reservation: { activeCount: 1, activeQuantity: 2, earliestExpiry: '2026-09-04T08:30:00.000Z' },
    sources: [{ id: 'stock:one', source: 'jdproduct', reference: 'source:one', location: 'warehouse:one', onhand: 10, safety: 1, reserved: 2, available: 7, state: 'active' as const, version: '2', watermark: '2026-09-04T08:00:00.000Z' }],
    version: '2',
    watermark: '2026-09-04T08:00:00.000Z',
  };
}

function row(overrides: Readonly<Record<string, unknown>>) {
  return {
    id: 'stock:one',
    sku: 'sku:one',
    scope: 'mall:one',
    location: 'warehouse:one',
    onhand: 10,
    safety: 1,
    reserved: 2,
    active_count: 1,
    earliest_expiry: new Date('2026-09-04T08:30:00.000Z'),
    status: 'active',
    version: '2',
    source: 'jdproduct',
    source_reference: 'source:one',
    watermark: new Date('2026-09-04T08:00:00.000Z'),
    ...overrides,
  };
}
