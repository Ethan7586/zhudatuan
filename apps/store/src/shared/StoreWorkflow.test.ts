import { describe, expect, it, vi } from 'vitest';
import { matchRoutePath } from '../generated/RouteBinding';
import { accountViewModel } from '../feature/account/viewmodel/AccountViewModel';
import { deviceViewModel } from '../feature/device/viewmodel/DeviceViewModel';
import { inventoryViewModel } from '../feature/inventory/viewmodel/InventoryViewModel';
import { orderViewModel } from '../feature/order/viewmodel/OrderViewModel';
import { returnViewModel } from '../feature/return/viewmodel/ReturnViewModel';
import { verificationViewModel } from '../feature/verification/viewmodel/VerificationViewModel';

const context = Object.freeze({ clientVersion: 'test', contractVersion: 'v5', traceId: 'trace:test', scope: { kind: 'store', id: 'store:one' }, idempotencyKey: 'command:test' }) as never;

describe('store operational workflows', () => {
  it('accepts only the selected fulfillment at its current version', async () => {
    const transition = vi.fn().mockResolvedValue({});
    const client = { fulfillment: { workitemsTransition: transition } } as never;
    const value = { items: [{ id: 'fulfillment:1', order_number: 'SO1', state: 'submitted', kind: 'pickup', version: 3, lines: [] }] };
    const route = routeAt('/scopes/store/store%3Aone/orders');
    const action = orderViewModel.actions!(value, route, 'fulfillment:1')[0]!;

    await orderViewModel.execute!(client, context, route, value, 'fulfillment:1', action, { note: '上午到店' });

    expect(transition).toHaveBeenCalledWith({ path: { fulfillmentid: 'fulfillment:1' }, body: { action: 'accept', note: '上午到店' } }, expect.objectContaining({ expectedVersion: 3 }));
  });

  it('separates return receipt from inspection and requires a rejection reason', async () => {
    const inspect = vi.fn().mockResolvedValue({});
    const client = { fulfillment: { returnsInspect: inspect } } as never;
    const value = { items: [{ id: 'return:1', state: 'received', version: 2 }] };
    const route = routeAt('/scopes/store/store%3Aone/returns');
    const reject = returnViewModel.actions!(value, route, 'return:1').find(({ id }) => id === 'reject')!;

    await returnViewModel.execute!(client, context, route, value, 'return:1', reject, { note: '商品已明显使用' });

    expect(inspect).toHaveBeenCalledWith({ path: { returnid: 'return:1' }, body: { accepted: false, inspection: { note: '商品已明显使用' } } }, expect.objectContaining({ expectedVersion: 2 }));
  });

  it('creates an approval-bound adjustment request without exposing a ledger mutation', async () => {
    const create = vi.fn().mockResolvedValue({});
    const clientValue = { inventory: { adjustmentsCreate: create } };
    const client = clientValue as never;
    const value = { mode: 'availability', page: { items: [{ sku: 'SKU1', sources: [{ id: 'stock:1', location: '一号库位', version: '7' }] }] } };
    const route = routeAt('/scopes/store/store%3Aone/inventory');
    const adjust = inventoryViewModel.actions!(value, route, 'stock:1').find(({ id }) => id === 'adjust')!;

    await inventoryViewModel.execute!(client, context, route, value, 'stock:1', adjust, { quantity: '-2', reason: '盘点差异' });

    expect(create).toHaveBeenCalledWith({ body: { stockitem: 'stock:1', quantityDelta: -2, reason: '盘点差异', expectedVersion: 7 } }, expect.objectContaining({ expectedVersion: 7 }));
    expect(Object.keys(clientValue.inventory)).toEqual(['adjustmentsCreate']);
  });

  it('redeems a voucher only after trusted-device verification', async () => {
    const issue = vi.fn().mockResolvedValue({ id: 'challenge:1', token: 'one-time-token' });
    const verify = vi.fn().mockResolvedValue({ verified: true });
    const client = { verification: { challengesIssue: issue, challengesVerify: verify } } as never;
    const route = routeAt('/scopes/store/store%3Aone/verification');
    const action = verificationViewModel.actions!({}, route)[0]!;

    await verificationViewModel.execute!(client, context, route, {}, undefined, action, { voucher: 'voucher:1', device: 'device-secret' });

    expect(issue).toHaveBeenCalledWith({ body: { purpose: 'voucher_redeem', voucher: 'voucher:1' } }, context);
    expect(verify).toHaveBeenCalledWith({ path: { challengeid: 'challenge:1' }, body: { token: 'one-time-token', device: 'device-secret' } }, expect.objectContaining({ idempotencyKey: expect.stringMatching(/^storecommand:/) }));
    expect(issue.mock.invocationCallOrder[0]).toBeLessThan(verify.mock.invocationCallOrder[0]!);
  });

  it('registers a device at version zero and ends the session immediately after handover', async () => {
    const manage = vi.fn().mockResolvedValue({});
    const deviceClient = { verification: { devicesManage: manage } } as never;
    const deviceRoute = routeAt('/scopes/store/store%3Aone/devices');
    const register = deviceViewModel.actions!({ items: [] }, deviceRoute)[0]!;
    await deviceViewModel.execute!(deviceClient, context, deviceRoute, { items: [] }, undefined, register, { id: 'device:1', label: '前台平板', fingerprint: 'device-secret' });
    expect(manage).toHaveBeenCalledWith(expect.objectContaining({ path: { deviceid: 'device:1' } }), expect.objectContaining({ expectedVersion: 0 }));

    const handover = vi.fn().mockResolvedValue({});
    const accountClient = { identity: { handoversCreate: handover } } as never;
    const accountRoute = routeAt('/scopes/store/store%3Aone/account');
    const action = accountViewModel.actions!({}, accountRoute)[0]!;
    const result = await accountViewModel.execute!(accountClient, context, accountRoute, {}, undefined, action, { note: '晚班已核对库存' });
    expect(handover).toHaveBeenCalledWith({ body: { note: '晚班已核对库存' } }, context);
    expect(result.sessionEnded).toBe(true);
  });
});

function routeAt(path: string) {
  const route = matchRoutePath(path);
  if (!route) throw new Error(`route missing: ${path}`);
  return route;
}
