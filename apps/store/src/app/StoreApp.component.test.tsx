import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { storeEnvironment } from '@shop/config/store';
import { ApiError } from '@shop/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION_CATALOG_HASH } from '../generated/NavigationBinding';
import { StoreApp } from './StoreApp';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('StoreApp operational journey', () => {
  it('binds the visible store and employee and confirms an order through the server', async () => {
    window.history.replaceState(null, '', '/scopes/store/store%3Aone/orders');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
    const transition = vi.fn().mockResolvedValue({});
    const submitted = workItem('submitted', 3);
    const accepted = workItem('accepted', 4);
    const client = {
      identity: { sessionRead: vi.fn().mockResolvedValue(session()) },
      navigation: { treeRead: vi.fn().mockResolvedValue(navigation()) },
      member: { profileRead: vi.fn().mockResolvedValue({ id: 'member:one', display_name: '王小明', employee_no: 'A100', status: 'active' }) },
      fulfillment: {
        workitemsRead: vi
          .fn()
          .mockResolvedValueOnce({ items: [submitted], count: 1 })
          .mockResolvedValueOnce({ items: [accepted], count: 1 }),
        workitemsTransition: transition,
      },
    };
    const user = userEvent.setup();
    render(<StoreApp dependencies={{ client, environment: storeEnvironment() } as never} />);

    expect(await screen.findByRole('heading', { name: '接单与备货' })).toBeTruthy();
    expect(screen.getAllByText('门店 · store:one')).toHaveLength(2);
    expect(screen.getByText('王小明 · 工号 A100')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /订单 SO1/ }));
    await user.click(screen.getByRole('button', { name: /确认由当前门店接单/ }));
    await user.click(screen.getByRole('button', { name: '确认接单' }));

    await waitFor(() =>
      expect(transition).toHaveBeenCalledWith(
        { path: { fulfillmentid: 'fulfillment:1' }, body: { action: 'accept' } },
        expect.objectContaining({ scope: { kind: 'store', id: 'store:one' }, csrfToken: 'csrf:store', expectedVersion: 3, idempotencyKey: expect.stringMatching(/^storecommand:/) })
      )
    );
    expect(await screen.findByText('接单成功，任务状态已由服务端更新。')).toBeTruthy();
  });

  it('completes an in-place identity step-up before retrying a protected command', async () => {
    window.history.replaceState(null, '', '/scopes/store/store%3Aone/orders');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
    const transition = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('STEPUP_REQUIRED', 403, 'request:stepup'))
      .mockResolvedValue({});
    const complete = vi.fn().mockResolvedValue({});
    const client = {
      identity: { sessionRead: vi.fn().mockResolvedValue(session()), stepupStart: vi.fn().mockResolvedValue({ id: 'challenge:stepup' }), stepupComplete: complete },
      navigation: { treeRead: vi.fn().mockResolvedValue(navigation()) },
      member: { profileRead: vi.fn().mockResolvedValue({ id: 'member:one', display_name: '王小明', employee_no: 'A100', status: 'active' }) },
      fulfillment: {
        workitemsRead: vi
          .fn()
          .mockResolvedValueOnce({ items: [workItem('submitted', 3)], count: 1 })
          .mockResolvedValueOnce({ items: [workItem('accepted', 4)], count: 1 }),
        workitemsTransition: transition,
      },
    };
    const user = userEvent.setup();
    render(<StoreApp dependencies={{ client, environment: storeEnvironment() } as never} />);

    await user.click(await screen.findByRole('button', { name: /订单 SO1/ }));
    await user.click(screen.getByRole('button', { name: /确认由当前门店接单/ }));
    await user.click(screen.getByRole('button', { name: '确认接单' }));
    expect(await screen.findByText('验证码已发送，请输入验证码后再次确认。')).toBeTruthy();
    await user.type(screen.getByLabelText('身份验证码（必填）'), '123456');
    await user.click(screen.getByRole('button', { name: '确认接单' }));

    await waitFor(() => expect(complete).toHaveBeenCalledWith({ body: { challenge: 'challenge:stepup', code: '123456' } }, expect.not.objectContaining({ scope: expect.anything() })));
    expect(transition).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('接单成功，任务状态已由服务端更新。')).toBeTruthy();
  });
});

function session() {
  return {
    target: 'store',
    actor: 'principal:one',
    session: 'session:one',
    membership: 'membership:one',
    scope: { kind: 'store', id: 'store:one' },
    scopes: [{ kind: 'store', id: 'store:one' }],
    accessVersion: 1,
    permissions: [],
    capabilities: [],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
    syncedAt: '2026-09-07T00:00:00Z',
    csrf: 'csrf:store',
  };
}

function navigation() {
  return {
    target: 'store',
    scope: { kind: 'store', id: 'store:one' },
    catalogVersion: NAVIGATION_CATALOG_HASH,
    defaultKey: 'storeorderswork',
    nodes: [{ key: 'storeorderswork', title: '接单与备货', children: [], experience: { disabled: false, placement: 'primary', routeKey: 'storeorderswork' } }],
  };
}

function workItem(state: string, version: number) {
  return {
    id: 'fulfillment:1',
    order_id: 'order:1',
    order_number: 'SO1',
    member_masked: '会员 001001',
    state,
    kind: 'pickup',
    priority: 'normal',
    version,
    lines: [{ line: 'line:1', sku: 'SKU1', title: '生日蛋糕', quantity: 1, packed: 0 }],
    updated_at: '2026-09-07T08:00:00Z',
  };
}
