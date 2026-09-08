import { afterEach, describe, expect, it, vi } from 'vitest';
import { aftersaleViewModel } from '../feature/aftersale/viewmodel/AftersaleViewModel';
import { catalogViewModel } from '../feature/catalog/viewmodel/CatalogViewModel';
import { connectionViewModel } from '../feature/connection/viewmodel/ConnectionViewModel';
import { fulfillmentViewModel } from '../feature/fulfillment/viewmodel/FulfillmentViewModel';
import { inventoryViewModel } from '../feature/inventory/viewmodel/InventoryViewModel';
import { invoiceViewModel } from '../feature/invoice/viewmodel/InvoiceViewModel';
import { orderViewModel } from '../feature/order/viewmodel/OrderViewModel';
import { pricingViewModel } from '../feature/pricing/viewmodel/PricingViewModel';
import { reconciliationViewModel } from '../feature/reconciliation/viewmodel/ReconciliationViewModel';
import { statementViewModel } from '../feature/statement/viewmodel/StatementViewModel';
import { supportViewModel } from '../feature/support/viewmodel/SupportViewModel';

afterEach(() => vi.unstubAllGlobals());

describe('supplier workflow', () => {
  it('creates a scoped draft and only exposes edit and review submission', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'product:one' });
    const update = vi.fn().mockResolvedValue({});
    const route = { id: 'suppliercatalog', parameters: { scopeKind: 'supplier', scopeId: 'supplier:one' } } as const;
    const createAction = catalogViewModel.actions!({ items: [] }, route as never).find(({ id }) => id === 'create')!;
    const created = await catalogViewModel.execute!({ catalog: { productsCreate: create } } as never, {} as never, route as never, { items: [] }, undefined, createAction, { title: '员工礼盒', category: '食品', type: 'physical', description: '供应商商品' });
    expect(create).toHaveBeenCalledWith({ body: { category: '食品', title: '员工礼盒', type: 'physical', attributes: { description: '供应商商品' } } }, {});
    expect(created.destination).toContain('/catalog/product%3Aone');

    const detail = { id: 'product:one', title: '员工礼盒', category_id: 'category:food', product_type: 'physical', status: 'draft', version: 2, updatedAt: '2026-09-07T00:00:00Z' };
    const detailRoute = { id: 'supplierproduct', parameters: { scopeKind: 'supplier', scopeId: 'supplier:one', productId: 'product:one' } } as const;
    const actions = catalogViewModel.actions!(detail, detailRoute as never).map(({ id }) => id);
    expect(actions).toEqual(['edit', 'submit']);
    expect(actions).not.toContain('publish');
    await catalogViewModel.execute!({ catalog: { productsUpdate: update } } as never, {} as never, detailRoute as never, detail, undefined, { id: 'submit' } as never, {});
    expect(update).toHaveBeenCalledWith({ path: { productid: 'product:one' }, body: { status: 'review' } }, { expectedVersion: 2 });
  });

  it('updates only a selected own listing price with optimistic concurrency', async () => {
    const set = vi.fn().mockResolvedValue({});
    const value = { items: [{ id: 'listing:one', sku_id: 'sku:one', title: '礼盒', price_amount_minor: 9900, price_version: 4, cursor_sort: '2026-09-07T00:00:00Z' }], count: 1 };
    const action = pricingViewModel.actions!(value, {} as never, 'listing:one')[0]!;
    await pricingViewModel.execute!({ catalog: { listingsPriceSet: set } } as never, {} as never, {} as never, value, 'listing:one', action, { amount: '108.50' });
    expect(set).toHaveBeenCalledWith({ path: { listingid: 'listing:one' }, body: { amountMinor: 10850 } }, { expectedVersion: 4 });
  });

  it('uploads an inventory file before creating a traceable import job', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const upload = vi.fn().mockResolvedValue({ reference: 'object:stock', upload: { url: 'https://objects.example.test/stock', headers: {}, expiresAt: '2026-09-07T01:00:00Z' } });
    const create = vi.fn().mockResolvedValue({ id: 'import:stock', state: 'queued', total_count: 0, cursor_value: 0, success_count: 0, failure_count: 0, created_at: '2026-09-07T00:00:00Z', updated_at: '2026-09-07T00:00:00Z' });
    const action = inventoryViewModel.actions!({}, {} as never).find(({ id }) => id === 'import')!;
    const file = new File(['sku,onhand\nSKU1,5'], 'stock.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'stream', { value: () => new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('sku,onhand\nSKU1,5')); controller.close(); } }) });
    await inventoryViewModel.execute!({ runtime: { uploadsCreate: upload }, inventory: { importsCreate: create } } as never, {} as never, {} as never, {}, undefined, action, { file });
    expect(upload).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({ body: expect.objectContaining({ objectRef: 'object:stock', fileName: 'stock.csv', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }) }, {});
  });

  it('confirms orders, ships packages and records return inspection without platform decisions', async () => {
    const transition = vi.fn().mockResolvedValue({});
    const work = { items: [{ id: 'fulfillment:one', order_number: 'SO1', member_masked: '会员 000001', state: 'submitted', kind: 'shipment', priority: 'normal', version: 3, lines: [], updated_at: '2026-09-07T00:00:00Z' }], count: 1 };
    await orderViewModel.execute!({ fulfillment: { workitemsTransition: transition } } as never, {} as never, {} as never, work, 'fulfillment:one', orderViewModel.actions!(work, {} as never, 'fulfillment:one')[0]!, {});
    expect(transition).toHaveBeenCalledWith({ path: { fulfillmentid: 'fulfillment:one' }, body: { action: 'accept' } }, { expectedVersion: 3 });

    const ship = vi.fn().mockResolvedValue({});
    const ready = { items: [{ ...work.items[0], state: 'ready', version: 4 }], count: 1 };
    await fulfillmentViewModel.execute!({ fulfillment: { shipmentsCreate: ship } } as never, {} as never, {} as never, ready, 'fulfillment:one', fulfillmentViewModel.actions!(ready, {} as never, 'fulfillment:one')[0]!, { tracking: 'SF100', carrier: '顺丰' });
    expect(ship).toHaveBeenCalledWith({ path: { fulfillmentid: 'fulfillment:one' }, body: { tracking: 'SF100', carrier: '顺丰' } }, { expectedVersion: 4 });

    const inspect = vi.fn().mockResolvedValue({});
    const returned = { items: [{ id: 'return:one', state: 'received', version: 2, lines: [] }], count: 1 };
    const reject = aftersaleViewModel.actions!(returned, {} as never, 'return:one').find(({ id }) => id === 'reject')!;
    await aftersaleViewModel.execute!({ fulfillment: { returnsInspect: inspect } } as never, {} as never, {} as never, returned, 'return:one', reject, { note: '外包装严重破损' });
    expect(inspect).toHaveBeenCalledWith({ path: { returnid: 'return:one' }, body: { accepted: false, inspection: { note: '外包装严重破损' } } }, { expectedVersion: 2 });
  });

  it('keeps statements, reconciliation and invoices read only', () => {
    expect(statementViewModel.actions).toBeUndefined();
    expect(reconciliationViewModel.actions).toBeUndefined();
    expect(invoiceViewModel.actions).toBeUndefined();
    expect(statementViewModel.execute).toBeUndefined();
    expect(reconciliationViewModel.execute).toBeUndefined();
    expect(invoiceViewModel.execute).toBeUndefined();
  });

  it('tests a versioned connection and sends an internal support message', async () => {
    const test = vi.fn().mockResolvedValue({});
    const connections = { items: [{ id: 'connection:one', provider: '京东', region: '华东', status: 'enabled', health_state: 'healthy', version: 5 }], count: 1 };
    await connectionViewModel.execute!({ channel: { connectionsTest: test } } as never, {} as never, {} as never, connections, 'connection:one', connectionViewModel.actions!(connections, {} as never, 'connection:one')[0]!, {});
    expect(test).toHaveBeenCalledWith({ path: { connectionid: 'connection:one' }, body: {} }, { expectedVersion: 5 });

    const send = vi.fn().mockResolvedValue({});
    const route = { id: 'suppliercase', parameters: { scopeKind: 'supplier', scopeId: 'supplier:one', caseId: 'case:one' } } as const;
    await supportViewModel.execute!({ support: { messagesSend: send } } as never, {} as never, route as never, { items: [], conversationVersion: 2 }, undefined, { id: 'send' } as never, { visibility: 'internal', message: '预计今天发货' });
    expect(send).toHaveBeenCalledWith({ path: { caseid: 'case:one' }, body: { message: '预计今天发货', clientMessageId: expect.any(String), visibility: 'internal' } }, {});
  });
});
