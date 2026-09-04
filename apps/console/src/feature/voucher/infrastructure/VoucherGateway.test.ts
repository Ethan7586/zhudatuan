import { VOUCHER_OPERATION_IDS, OP_VOUCHER_PRODUCTS_CREATE } from '@shop/contract/ids';
import { VOUCHER_METHOD_BY_OPERATION, type VoucherOperations } from '@shop/sdk/voucher';
import { describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { VoucherGateway } from './VoucherGateway';

describe('VoucherGateway generated dispatch', () => {
  it('dispatches all 57 authoritative voucher operations without a handwritten switch', async () => {
    const invoked: string[] = [];
    const client = Object.fromEntries(VOUCHER_OPERATION_IDS.map((operation) => [
      VOUCHER_METHOD_BY_OPERATION[operation],
      vi.fn(() => { invoked.push(operation); return Promise.resolve({ id: `receipt:${invoked.length}`, state: 'accepted' }); }),
    ])) as unknown as VoucherOperations;
    const gateway = new VoucherGateway('https://api.example.invalid', undefined, client);

    for (const operation of VOUCHER_OPERATION_IDS) {
      const receipt = await gateway.execute(context, { operation, input: Object.freeze({}), options: { identity: `voucher:test:${invoked.length}` } });
      expect(receipt.operation).toBe(operation);
    }

    expect(VOUCHER_OPERATION_IDS).toHaveLength(57);
    expect(Object.keys(VOUCHER_METHOD_BY_OPERATION)).toEqual([...VOUCHER_OPERATION_IDS]);
    expect(invoked).toEqual([...VOUCHER_OPERATION_IDS]);
  });

  it('rejects a write before transport when its idempotency identity is absent', async () => {
    const client = { productsCreate: vi.fn() } as unknown as VoucherOperations;
    const gateway = new VoucherGateway('https://api.example.invalid', undefined, client);
    await expect(gateway.execute(context, { operation: OP_VOUCHER_PRODUCTS_CREATE, input: Object.freeze({}) })).rejects.toThrow('VOUCHER_IDEMPOTENCY_REQUIRED');
    expect(client.productsCreate).not.toHaveBeenCalled();
  });

  it('maps options, facets, exact lookup, timeline and every progress source to domain models', async () => {
    const client = {
      productoptionsList: vi.fn(() => Promise.resolve({ items: [{ id: 'product:one', number: 'VP001', name: '员工餐券', faceMinor: 2000, currency: 'CNY', available: 30 }], count: 1 })),
      stockrequestoptionsList: vi.fn(() => Promise.resolve({ items: [{ request: 'stock:one', number: 'SR001', product: 'product:one', pool: 'pool:one', customer: 'customer:one', available: 20, approved: 20 }], count: 1 })),
      searchfacetsRead: vi.fn(() => Promise.resolve({ states: [{ value: 'active', count: 2 }], products: [], pools: [], watermark: '2026-09-04T00:00:00.000Z' })),
      vouchersGetbynumber: vi.fn(() => Promise.resolve(voucher)),
      vouchersTimeline: vi.fn(() => Promise.resolve({ items: [{ sequence: 1, previous: 'available', next: 'bound', reason: '成员领取', actor: 'member:one', occurredAt: '2026-09-04T00:00:00.000Z', redemption: null }], count: 1 })),
      jobsGet: vi.fn(() => Promise.resolve({ id: 'job:one', kind: 'generate', state: 'running', processed: 4, total: 10, succeeded: 4, failed: 0, retryable: 0, updatedAt: '2026-09-04T00:00:00.000Z' })),
      exportsGet: vi.fn(() => Promise.resolve({ id: 'export:one', kind: 'search', state: 'completed', expiresAt: '2026-09-05T00:00:00.000Z', fileName: 'vouchers.csv', downloadToken: 'opaque', createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z' })),
      issuebatchesGet: vi.fn(() => Promise.resolve({ id: 'issue:one', order: 'order:one', scopeId: 'platform:commerce', state: 'running', requested: 10, processed: 5, succeeded: 4, failed: 1, retryable: 1, version: 2, createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z' })),
      actionbatchesGet: vi.fn(() => Promise.resolve({ id: 'action:one', scopeId: 'platform:commerce', snapshot: 'snapshot:one', action: 'disable', reason: '风控处置', expiresAt: null, state: 'running', requested: 10, processed: 5, succeeded: 5, failed: 0, retryable: 0, version: 2, createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z' })),
    } as unknown as VoucherOperations;
    const gateway = new VoucherGateway('https://api.example.invalid', undefined, client);

    expect((await gateway.choices(context, 'product')).items[0]?.fill.product).toBe('product:one');
    expect((await gateway.choices(context, 'stock')).items[0]?.fill.customer).toBe('customer:one');
    expect((await gateway.facets(context, {})).states[0]?.count).toBe(2);
    expect((await gateway.byNumber(context, 'CARD0001')).name).toBe('CARD***0001');
    expect((await gateway.timeline(context, 'voucher:one')).items[0]?.next).toBe('bound');
    expect((await gateway.progress(context, 'job', 'job:one')).processed).toBe(4);
    expect((await gateway.progress(context, 'export', 'export:one')).fileName).toBe('vouchers.csv');
    expect((await gateway.progress(context, 'issue', 'issue:one')).retryable).toBe(1);
    expect((await gateway.progress(context, 'action', 'action:one')).succeeded).toBe(5);
  });
});

const context = {
  session: { actor: 'actor:test', membership: 'membership:test', accessVersion: 3, csrf: 'csrf-token-at-least-sixteen-characters' },
  scope: { kind: 'platform', id: 'platform:commerce', name: '测试平台' },
} as unknown as ConsoleContext;

const voucher = { id: 'voucher:one', numberMasked: 'CARD***0001', scopeId: 'platform:commerce', product: 'product:one', productName: '员工餐券', credential: 'credential:one', holder: 'member:one', initialMinor: 2000, remainingMinor: 1000, currency: 'CNY', state: 'bound', validity: { startsAt: '2026-09-04T00:00:00.000Z', expiresAt: '2027-09-04T00:00:00.000Z' }, version: 2, createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z' };
