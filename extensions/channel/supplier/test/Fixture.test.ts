import { describe, expect, it } from 'vitest';
import type { ProviderCallContext } from '@shop/contract';
import type { LocalProviderRuntime } from '@shop/providercore';
import { createSupplierInstallation } from '../integration/Local';
import { SupplierConfig } from '../Config';

describe('supplier local fixture', () => {
  it('accepts only declarative endpoints and dotted field templates', () => {
    const endpoints = { catalog: '/catalog', stock: '/stock', quote: '/quote', order: '/orders', tracking: '/orders/{id}', statement: '/statements' };
    expect(SupplierConfig.protocol({ endpoints, fields: { productId: 'data.item.id', stock: 'data.inventory.available' } })).toMatchObject({ endpoints });
    expect(() => SupplierConfig.protocol({ endpoints, fields: { productId: '(() => process.exit())()' } })).toThrow('SUPPLIER_FIELD_TEMPLATE_INVALID');
    expect(() => SupplierConfig.protocol({ endpoints, fields: {}, execute: 'code' })).toThrow('SUPPLIER_PROTOCOL_CONFIG_UNKNOWN_KEY');
  });

  it('routes all standard capabilities through scoped platform operations', async () => {
    const calls: string[] = [];
    const replies = new Map<string, unknown>([
      ['channel.supplier_enabled', true], ['channel.pull_supplier_catalog', { records: [], errors: [], complete: true }], ['channel.pull_supplier_stock', { records: [] }], ['channel.quote_supplier_products', { records: [] }],
      ['channel.submit_supplier_order', { externalReference: 'remote-order', state: 'submitted', rawReference: 'safe-reference' }], ['channel.cancel_supplier_order', { externalReference: 'remote-order', state: 'cancelled' }],
      ['channel.pull_supplier_tracking', { externalReference: 'remote-order', milestones: [] }], ['channel.authorize_supplier_return', { externalReference: 'remote-return', state: 'authorized', instruction: {} }],
      ['channel.submit_supplier_refund', { externalReference: 'remote-refund', state: 'submitted' }], ['channel.build_supplier_statement', { objectRef: 'statement/object', sha256: 'a'.repeat(64) }],
    ]);
    const runtime: LocalProviderRuntime = { scope: 'mall-1', async invoke(operation) { calls.push(operation); return replies.get(operation); } };
    const installation = createSupplierInstallation(runtime);
    const context = callContext();
    await installation.ports.catalog!.pullCatalog(context);
    await installation.ports.stock!.pullStock(context, [{ externalId: 'sku-1' }]);
    await installation.ports.price!.pullPrice(context, [{ externalId: 'sku-1' }]);
    await installation.ports.order!.submit(context, { reference: 'order-1', payload: {} });
    await installation.ports.cancel!.cancel(context, 'order-1', '用户取消');
    await installation.ports.tracking!.pullTracking(context, 'order-1');
    await installation.ports.return!.authorize(context, { reference: 'return-1', fulfillmentReference: 'shipment-1', reason: '破损', lines: [], evidence: {} });
    await installation.ports.refund!.refund(context, { reference: 'refund-1', amountMinor: 100, currency: 'CNY', reason: '退货' });
    await installation.ports.statement!.pullStatement(context, { start: '2026-09-01', end: '2026-09-02', timezone: 'Asia/Shanghai' });
    expect(await installation.health()).toBe(true);
    expect(calls).toHaveLength(10);
  });
});

function callContext(): ProviderCallContext {
  return { tenantId: 'tenant-1', requestId: 'request-1', traceId: 'trace-1', idempotencyKey: 'idempotency-1', deadline: Date.now() + 10_000 };
}
