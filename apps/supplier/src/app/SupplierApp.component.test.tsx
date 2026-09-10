import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { supplierEnvironment } from '@shop/config/supplier';
import { ApiError } from '@shop/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION_CATALOG_HASH } from '../generated/NavigationBinding';
import { SupplierApp } from './SupplierApp';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('SupplierApp operational journey', () => {
  it('binds the supplier and employee and confirms an order through the platform', async () => {
    window.history.replaceState(null, '', '/scopes/supplier/supplier%3Aone/orders');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
    const transition = vi.fn().mockResolvedValue({});
    const client = clientFixture(transition);
    const user = userEvent.setup();
    render(<SupplierApp dependencies={{ client, environment: supplierEnvironment() } as never} />);

    expect(await screen.findByRole('heading', { name: '订单确认与备货' })).toBeTruthy();
    expect(screen.getAllByText('供应商 · supplier:one')).toHaveLength(2);
    expect(screen.getByText('王小明 · 工号 S100')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /订单 SO1/ }));
    await user.click(screen.getByRole('button', { name: /确认由当前供应商承接订单/ }));
    await user.click(screen.getByRole('button', { name: '确认接单' }));

    await waitFor(() =>
      expect(transition).toHaveBeenCalledWith(
        { path: { fulfillmentid: 'fulfillment:1' }, body: { action: 'accept' } },
        expect.objectContaining({ scope: { kind: 'supplier', id: 'supplier:one' }, csrfToken: 'csrf:supplier', expectedVersion: 3, idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/) })
      )
    );
    expect(await screen.findByText('接单成功，平台履约状态已同步更新。')).toBeTruthy();
  });

  it('completes identity step-up in place before retrying a protected supplier command', async () => {
    window.history.replaceState(null, '', '/scopes/supplier/supplier%3Aone/orders');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
    const transition = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('STEPUP_REQUIRED', 403, 'request:stepup'))
      .mockResolvedValue({});
    const complete = vi.fn().mockResolvedValue({});
    const client = { ...clientFixture(transition), identity: { ...clientFixture(transition).identity, stepupStart: vi.fn().mockResolvedValue({ id: 'challenge:one' }), stepupComplete: complete } };
    const user = userEvent.setup();
    render(<SupplierApp dependencies={{ client, environment: supplierEnvironment() } as never} />);

    await user.click(await screen.findByRole('button', { name: /订单 SO1/ }));
    await user.click(screen.getByRole('button', { name: /确认由当前供应商承接订单/ }));
    await user.click(screen.getByRole('button', { name: '确认接单' }));
    expect(await screen.findByText('验证码已发送，请输入验证码后再次确认。')).toBeTruthy();
    await user.type(screen.getByLabelText('身份验证码（必填）'), '123456');
    await user.click(screen.getByRole('button', { name: '确认接单' }));

    await waitFor(() => expect(complete).toHaveBeenCalledWith({ body: { challenge: 'challenge:one', code: '123456' } }, expect.not.objectContaining({ scope: expect.anything() })));
    expect(transition).toHaveBeenCalledTimes(2);
  });
});

function clientFixture(transition: ReturnType<typeof vi.fn>) {
  return {
    identity: { sessionRead: vi.fn().mockResolvedValue(session()) },
    navigation: { treeRead: vi.fn().mockResolvedValue(navigation()) },
    member: { profileRead: vi.fn().mockResolvedValue({ id: 'member:one', display_name: '王小明', employee_no: 'S100', status: 'active' }) },
    fulfillment: {
      workitemsRead: vi
        .fn()
        .mockResolvedValueOnce({ items: [workItem('submitted', 3)], count: 1 })
        .mockResolvedValueOnce({ items: [workItem('accepted', 4)], count: 1 }),
      workitemsTransition: transition,
    },
  };
}

function session() {
  return {
    target: 'supplier',
    actor: 'principal:one',
    session: 'session:one',
    membership: 'membership:one',
    scope: { kind: 'supplier', id: 'supplier:one' },
    scopes: [{ kind: 'supplier', id: 'supplier:one' }],
    accessVersion: 1,
    permissions: [],
    capabilities: [],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
    syncedAt: '2026-09-07T00:00:00Z',
    csrf: 'csrf:supplier',
  };
}

function navigation() {
  return {
    target: 'supplier',
    scope: { kind: 'supplier', id: 'supplier:one' },
    catalogVersion: NAVIGATION_CATALOG_HASH,
    defaultKey: 'supplierorders',
    nodes: [{ key: 'supplierorders', title: '订单处理', children: [], experience: { disabled: false, placement: 'primary', routeKey: 'supplierorders' } }],
  };
}

function workItem(state: string, version: number) {
  return {
    id: 'fulfillment:1',
    order_id: 'order:1',
    order_number: 'SO1',
    member_masked: '会员 001001',
    state,
    kind: 'shipment',
    priority: 'normal',
    version,
    lines: [{ line: 'line:1', sku: 'SKU1', title: '员工礼盒', quantity: 1, packed: 0 }],
    updated_at: '2026-09-07T08:00:00Z',
  };
}
