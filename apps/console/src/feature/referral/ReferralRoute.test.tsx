import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './ReferralRoute';

const requests: string[] = [];
const decisionRequests: Array<
  Readonly<{
    path: string;
    body: unknown;
    expectedVersion: string | null;
    idempotency: string | null;
    csrf: string | null;
    scope: string | null;
  }>
> = [];
let reviewMembers: readonly unknown[] = [];
let memberReads = 0;
const server = setupServer(
  http.get('*/api/v1/referral/settings', ({ request }) => {
    requests.push(`${new URL(request.url).pathname}:${request.headers.get('x-scope-hint')}`);
    return HttpResponse.json(setting);
  }),
  http.get('*/api/v1/referral/products', () => HttpResponse.json({ items: [product], count: 1 })),
  http.get('*/api/v1/referral/members', () => {
    memberReads += 1;
    return HttpResponse.json({ items: reviewMembers, count: reviewMembers.length });
  }),
  http.post('*/api/v1/referral/members/approve', async ({ request }) => {
    decisionRequests.push(await decisionRequest(request));
    await delay(75);
    reviewMembers = [];
    return HttpResponse.json(memberDecisionReceipt('active'));
  }),
  http.post('*/api/v1/referral/members/disqualify', async ({ request }) => {
    decisionRequests.push(await decisionRequest(request));
    reviewMembers = [];
    return HttpResponse.json(memberDecisionReceipt('disqualified'));
  }),
  http.get('*/api/v1/referral/bindings', () => HttpResponse.json({ items: [], count: 0 })),
  http.get('*/api/v1/referral/commissions', ({ request }) => {
    const state = new URL(request.url).searchParams.get('state');
    requests.push(`commissions:${state ?? 'all'}`);
    return HttpResponse.json({ items: state === 'settled' ? [settledCommission, pendingCommission] : [pendingCommission], count: 1 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  reviewMembers = [member];
  memberReads = 0;
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  requests.length = 0;
  decisionRequests.length = 0;
  currentPath = '';
});
afterAll(() => server.close());

describe('Referral operator workspace', () => {
  it('publishes six deep-linked reads and keeps monthly withdrawal policy as a count', async () => {
    const user = userEvent.setup();
    renderRoute('/scopes/mall/mall%3Aconsole/referral/settings');

    expect(await screen.findByRole('table', { name: '分销设定' })).toBeTruthy();
    expect(screen.getByText(/每月最多提现 3 次/)).toBeTruthy();
    expect(screen.getByText('¥50.00')).toBeTruthy();
    expect(requests).toContain('/api/v1/referral/settings:mall:console');

    await user.click(screen.getByRole('button', { name: '分销商品' }));
    expect(await screen.findByRole('table', { name: '分销商品' })).toBeTruthy();
    expect(screen.getByText('精选咖啡礼盒')).toBeTruthy();
    expect(currentPath).toBe('/scopes/mall/mall%3Aconsole/referral/products');

    await user.click(screen.getByRole('button', { name: '分销审核' }));
    expect(await screen.findByRole('table', { name: '分销审核' })).toBeTruthy();
    expect(screen.getByText('待审核会员')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '分销关系' }));
    expect(await screen.findByRole('heading', { name: '暂无数据' })).toBeTruthy();
  });

  it('shows only server-settled withdrawable commission and keeps promotion states separate', async () => {
    const user = userEvent.setup();
    renderRoute('/scopes/mall/mall%3Aconsole/referral/withdrawals');

    expect(await screen.findByRole('table', { name: '佣金提现' })).toBeTruthy();
    expect(screen.getByText('¥65.00')).toBeTruthy();
    expect(screen.queryByText('¥20.00')).toBeNull();
    expect(screen.getByText(/当前页可提现合计 ¥65.00/)).toBeTruthy();
    expect(requests).toContain('commissions:settled');

    await user.click(screen.getByRole('button', { name: '推广详情' }));
    expect(await screen.findByRole('table', { name: '推广详情' })).toBeTruthy();
    expect(screen.getByText('¥20.00')).toBeTruthy();
    expect(screen.getByText('待处理')).toBeTruthy();
    expect(requests).toContain('commissions:all');
  });

  it('fails closed outside mall scope without issuing a referral request', async () => {
    renderRoute('/scopes/enterprise/enterprise%3A1/referral/settings', enterpriseContext);

    expect(await screen.findByRole('heading', { name: '无权访问' })).toBeTruthy();
    expect(screen.getByText(/仅在商城范围可用/)).toBeTruthy();
    expect(requests).toHaveLength(0);
  });

  it('fails closed when the capability exists without the matching read permission', async () => {
    renderRoute('/scopes/mall/mall%3Aconsole/referral/settings', capabilityOnlyContext);

    expect(await screen.findByRole('heading', { name: '无权访问' })).toBeTruthy();
    expect(screen.getByText(/缺少 referral\.settings\.read 权限/)).toBeTruthy();
    expect(requests).toHaveLength(0);
  });

  it('renders the shared API error state without fallback data', async () => {
    server.use(http.get('*/api/v1/referral/settings', () => HttpResponse.json({ code: 'REFERRAL_READ_FAILED' }, { status: 500 })));
    renderRoute('/scopes/mall/mall%3Aconsole/referral/settings');

    expect(await screen.findByRole('heading', { name: '加载失败' })).toBeTruthy();
    expect(screen.getByText('数据不可用')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '分销设定' })).toBeNull();
  });

  it('approves with If-Match, idempotency and CSRF, then refreshes only the current review page', async () => {
    const user = userEvent.setup();
    renderRoute('/scopes/mall/mall%3Aconsole/referral/review');
    await screen.findByRole('table', { name: '分销审核' });

    await user.click(screen.getByRole('button', { name: '通过 待审核会员' }));
    const pending = await screen.findByRole('button', { name: '正在通过 待审核会员…' });
    expect(pending).toHaveProperty('disabled', true);
    expect(await screen.findByRole('heading', { name: '暂无数据' })).toBeTruthy();
    expect(screen.getByText('审核状态已更新，列表已重读。')).toBeTruthy();

    expect(memberReads).toBe(2);
    expect(decisionRequests).toHaveLength(1);
    expect(decisionRequests[0]).toMatchObject({
      path: '/api/v1/referral/members/approve',
      body: { member: 'referral-member:pending' },
      expectedVersion: '"0"',
      csrf: 'csrf-referral-console',
      scope: 'mall:console',
    });
    expect(decisionRequests[0]?.idempotency).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('disqualifies through its dedicated operation and preserves the same version boundary', async () => {
    const user = userEvent.setup();
    renderRoute('/scopes/mall/mall%3Aconsole/referral/review');
    await screen.findByRole('table', { name: '分销审核' });

    await user.click(screen.getByRole('button', { name: '取消资格 待审核会员' }));
    expect(await screen.findByRole('heading', { name: '暂无数据' })).toBeTruthy();
    expect(decisionRequests[0]).toMatchObject({
      path: '/api/v1/referral/members/disqualify',
      body: { member: 'referral-member:pending' },
      expectedVersion: '"0"',
    });
  });

  it('keeps review actions fail-closed without both permission and capability', async () => {
    renderRoute('/scopes/mall/mall%3Aconsole/referral/review', readOnlyContext);
    await screen.findByRole('table', { name: '分销审核' });

    expect(screen.getByRole('button', { name: '通过 待审核会员' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '取消资格 待审核会员' })).toHaveProperty('disabled', true);
    expect(decisionRequests).toHaveLength(0);
  });

  it('surfaces decision errors and keeps the authoritative row available for retry', async () => {
    server.use(http.post('*/api/v1/referral/members/approve', () => HttpResponse.json({ code: 'REFERRAL_MEMBER_STATE_CONFLICT' }, { status: 409 })));
    const user = userEvent.setup();
    renderRoute('/scopes/mall/mall%3Aconsole/referral/review');
    await screen.findByRole('table', { name: '分销审核' });

    await user.click(screen.getByRole('button', { name: '通过 待审核会员' }));
    expect((await screen.findByRole('alert')).textContent).toContain('审核操作失败');
    expect(screen.getByText('待审核会员')).toBeTruthy();
    expect(memberReads).toBe(1);
  });
});

let currentPath = '';

function LocationProbe() {
  currentPath = useLocation().pathname;
  return null;
}

function renderRoute(entry: string, value: ConsoleContext = context) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={value}>
          <LocationProbe />
          <Component />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const capabilities = ['referral.settings.read', 'referral.products.read', 'referral.members.read', 'referral.bindings.read', 'referral.commissions.read'];
const reviewOperations = ['referral.members.approve', 'referral.members.disqualify'];

const context: ConsoleContext = {
  session: {
    actor: 'actor:referral',
    membership: 'membership:referral',
    accessVersion: 9,
    permissions: [...capabilities, ...reviewOperations],
    capabilities: [...capabilities, ...reviewOperations],
    target: 'console',
    scope: { kind: 'mall', id: 'mall:console', name: '主打团商城' },
    scopes: [{ kind: 'mall', id: 'mall:console', name: '主打团商城' }],
    assurance: { level: 2 },
    csrf: 'csrf-referral-console',
    syncedAt: '2026-08-29T02:00:00.000Z',
  },
  profile: { display_name: '分销运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:console', name: '主打团商城' },
  scopes: [{ kind: 'mall', id: 'mall:console', name: '主打团商城' }],
};

const readOnlyContext: ConsoleContext = {
  ...context,
  session: { ...context.session, permissions: capabilities, capabilities },
};

const capabilityOnlyContext: ConsoleContext = {
  ...context,
  session: { ...context.session, permissions: reviewOperations, capabilities: [...capabilities, ...reviewOperations] },
};

const enterpriseContext: ConsoleContext = {
  ...context,
  session: {
    ...context.session,
    scope: { kind: 'enterprise', id: 'enterprise:1', name: '主打团集团' },
    scopes: [{ kind: 'enterprise', id: 'enterprise:1', name: '主打团集团' }],
  },
  scope: { kind: 'enterprise', id: 'enterprise:1', name: '主打团集团' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:1', name: '主打团集团' }],
};

const setting = {
  id: 'referral-setting:mall:console',
  scope_id: 'mall:console',
  enabled: true,
  recruit_enabled: true,
  review_required: true,
  reward_enabled: true,
  binding_mode: 'permanent',
  binding_days: null,
  settle_trigger: 'on_received',
  settle_delay_days: 7,
  withdraw_min_minor: '5000',
  withdraw_monthly_max: 3,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-29T00:00:00.000Z',
  version: '4',
};

const product = {
  id: 'referral-product:coffee',
  scope_id: 'mall:console',
  sku_id: 'sku:coffee',
  code: 'COFFEE-01',
  product_id: 'product:coffee',
  listing_id: 'listing:coffee',
  title: '精选咖啡礼盒',
  listing_status: 'published',
  commission_bps: 1200,
  reward_bps: 300,
  enabled: true,
  created_at: '2026-08-20T00:00:00.000Z',
  updated_at: '2026-08-29T00:00:00.000Z',
  version: 2,
};

const member = {
  id: 'referral-member:pending',
  scope_id: 'mall:console',
  member_id: 'member:pending',
  display_name: '待审核会员',
  inviter_member_id: 'referral-member:parent',
  inviter_profile_id: 'member:parent',
  inviter_display_name: '一级邀请人',
  state: 'pending',
  approved_by: null,
  approved_at: null,
  created_at: '2026-08-29T01:00:00.000Z',
  updated_at: '2026-08-29T01:00:00.000Z',
  version: 0,
};

function memberDecisionReceipt(state: 'active' | 'disqualified') {
  return {
    id: member.id,
    scope_id: member.scope_id,
    member_id: member.member_id,
    inviter_member_id: member.inviter_member_id,
    state,
    approved_by: 'actor:referral',
    approved_at: '2026-08-29T02:30:00.000Z',
    created_at: member.created_at,
    updated_at: '2026-08-29T02:30:00.000Z',
    version: 1,
  };
}

async function decisionRequest(request: Request) {
  return {
    path: new URL(request.url).pathname,
    body: await request.json(),
    expectedVersion: request.headers.get('if-match'),
    idempotency: request.headers.get('idempotency-key'),
    csrf: request.headers.get('x-csrf-token'),
    scope: request.headers.get('x-scope-hint'),
  };
}

const commissionBase = {
  scope_id: 'mall:console',
  order_line_id: 'line:1',
  sku_id: 'sku:coffee',
  beneficiary_member_id: 'member:referral',
  beneficiary_display_name: '导购会员',
  kind: 'commission',
  currency: 'CNY',
  base_minor: '10000',
  rate_bps: 1000,
  reversed_base_minor: '0',
  reversed_minor: '0',
  claimed_minor: '500',
  recovery_minor: '0',
  origin_event_id: 'event:paid',
  setting_version: 4,
  product_version: 2,
  settle_trigger: 'on_received',
  settle_delay_days: 7,
  reversal_journal_id: null,
  reversal_event_id: null,
  reversed_at: null,
  created_at: '2026-08-20T00:00:00.000Z',
  updated_at: '2026-08-29T00:00:00.000Z',
  version: 2,
};

const settledCommission = {
  ...commissionBase,
  id: 'referral-commission:settled',
  order_id: 'order:settled',
  amount_minor: '7000',
  withdrawable_minor: '6500',
  state: 'settled',
  eligible_at: '2026-08-27T00:00:00.000Z',
  journal_id: 'journal:settled',
  settling_at: '2026-08-28T00:00:00.000Z',
  settled_at: '2026-08-29T00:00:00.000Z',
};

const pendingCommission = {
  ...commissionBase,
  id: 'referral-commission:pending',
  order_id: 'order:pending',
  amount_minor: '2000',
  claimed_minor: '0',
  withdrawable_minor: '0',
  state: 'pending',
  eligible_at: null,
  journal_id: null,
  settling_at: null,
  settled_at: null,
};
