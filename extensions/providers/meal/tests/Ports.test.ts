import { describe, expect, it, vi } from 'vitest';
import type { ProviderCallContext } from '@shop/contract';
import type { VendorConnection } from '@shop/vendorcore';
import { createMealPorts, MealProvider, type MealTransport } from '../Provider';
import { buildMealOrderInvocation } from '../OrderDraft';
import { manifest } from '../manifest';

const context: ProviderCallContext = { tenantId: 'tenant', requestId: 'request', traceId: 'trace', deadline: Date.now() + 5_000 };
const connection: VendorConnection = {
  id: 'meal-test', baseUrl: 'https://dev.dangaoss.cn', secret: { channelNo: 'channel', channelKey: 'key' },
  endpoints: { health: '/h5/online/kfc_list_by_store', 'meal.menu.kfc.STORE-1': '/h5/online/kfc_list_by_store' },
  healthOperation: 'health', limits: { connectionTimeoutMs: 100, responseTimeoutMs: 100, totalDeadlineMs: 1_000,
    maxConcurrency: 2, requestsPerSecond: 10, maxAttempts: 2, failureThreshold: 2, recoveryMs: 1_000 },
};

describe('meal provider ports', () => {
  it('exposes only the safe read-only runtime ports', () => {
    const provider = MealProvider.create({ manifest: manifest('signed'), connection });
    expect(provider.has('catalog')).toBe(true);
    expect(provider.has('price')).toBe(true);
    expect(provider.has('order')).toBe(false);
    expect(provider.has('webhook')).toBe(false);
  });

  it('pulls a configured store menu and maps store-scoped products', async () => {
    const invoke = vi.fn(async () => ({ code: 200, msg: 'success', data: { menu: [{ menu_list: [
      { link_id: 'K1', name_cn: 'Burger', price: '12.34', amount: '10.50', image: 'https://img.example/k1.png' },
    ] }] } }));
    const ports = createMealPorts({ invoke } as MealTransport, connection);
    const batch = await ports.catalog.pullCatalog(context);
    expect(batch.complete).toBe(true);
    expect(batch.records[0]).toMatchObject({ externalId: 'kfc:STORE-1:K1', payload: {
      schema: 'cakeuncle.meal-product.v1', brand: 'kfc', storeCode: 'STORE-1', amountMinor: 1050,
    } });
    expect(invoke).toHaveBeenCalledWith(context, expect.objectContaining({ operation: 'meal.menu.kfc.STORE-1',
      encoding: 'form', body: { store_code: 'STORE-1' } }));
  });

  it('reuses one explicit menu snapshot for canonical prices', async () => {
    const invoke = vi.fn(async () => ({ code: 200, msg: 'success', data: { menu: [{ menu_list: [
      { link_id: 'K1', name_cn: 'Burger', amount: '10.50', price: '12.00' },
    ] }] } }));
    const ports = createMealPorts({ invoke } as MealTransport, connection, undefined, () => new Date('2026-08-29T00:00:00.000Z'));
    const batch = await ports.price.pullPrice(context, [{ externalId: 'kfc:STORE-1:K1' }]);
    expect(batch.records).toEqual([expect.objectContaining({ externalId: 'kfc:STORE-1:K1', amountMinor: 1050,
      currency: 'CNY', effectiveAt: '2026-08-29T00:00:00.000Z' })]);
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('builds but does not expose non-idempotent meal orders', () => {
    const invocation = buildMealOrderInvocation({ reference: 'order-1', payload: { schema: 'cakeuncle.meal-order.v1',
      brand: 'kfc', phone: '13800000000', storeCode: 'STORE-1', model: 1,
      goods: [{ quantity: 1, link_id: 'K1', amount: '10.50', total_amount: '10.50' }] } });
    expect(invocation).toMatchObject({ operation: 'meal.order.kfc', path: '/h5/online/kfc_create_order',
      encoding: 'form', idempotent: false });
    expect(invocation.body).not.toHaveProperty('out_order_no');
  });
});
