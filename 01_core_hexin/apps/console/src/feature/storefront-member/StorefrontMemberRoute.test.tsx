import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './StorefrontMemberRoute';

const requests: Request[] = [];
let holdRefresh = false;
let releaseRefresh: (() => void) | undefined;
const server = setupServer(
  http.get('*/api/v1/member/storefront-members', async ({ request }) => {
    requests.push(request.clone());
    if (holdRefresh) await new Promise<void>((resolve) => { releaseRefresh = resolve; });
    return HttpResponse.json(memberPage);
  }),
  http.get('*/api/v1/member/storefront-members/:membershipid', () => HttpResponse.json(memberDetail)),
  http.get('*/api/v1/member/storefront-members/:membershipid/invitees', ({ request }) => {
    requests.push(request.clone());
    return HttpResponse.json(inviteePage);
  }),
  http.get('*/api/v1/member/storefront-members/:membershipid/orders', ({ request }) => {
    requests.push(request.clone());
    return HttpResponse.json(orderPage);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  releaseRefresh?.();
  releaseRefresh = undefined;
  holdRefresh = false;
  requests.length = 0;
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

describe('storefront member workspace', () => {
  it('renders a dynamic, read-only mall roster and sends server-side search and pagination through the generated SDK', async () => {
    const user = userEvent.setup();
    renderRoute();
    const table = await screen.findByRole('table', { name: '商城会员名单' });

    expect(screen.getByRole('heading', { level: 1, name: '商城会员' })).toBeTruthy();
    expect(within(table).getByText('测试消费者')).toBeTruthy();
    expect(within(table).getByText('188****8866')).toBeTruthy();
    expect(within(table).getByText('消费者')).toBeTruthy();
    expect(screen.queryByText(/L6|membership:storefront:test/)).toBeNull();
    expect(within(table).getAllByText('已绑定')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /邀请码|角色编辑|重置/ })).toBeNull();

    const search = screen.getByRole('searchbox', { name: '搜索商城会员' });
    await user.type(search, '8866');
    await user.click(screen.getByRole('button', { name: '搜索' }));
    await waitFor(() => expect(new URL(requests.at(-1)!.url).searchParams.get('q')).toBe('8866'));
    expect(new URL(requests.at(-1)!.url).searchParams.get('limit')).toBe('25');
    expect(requests.at(-1)?.headers.get('x-scope-hint')).toBe('mall:test');

    await user.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(new URL(requests.at(-1)!.url).searchParams.get('cursor')).toBe('cursor:next'));
  });

  it('keeps the current roster visible while a manual refresh is running', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole('table', { name: '商城会员名单' });

    holdRefresh = true;
    await user.click(screen.getByRole('button', { name: '刷新会员名单' }));
    expect(await screen.findByRole('button', { name: '正在刷新会员名单' })).toBeTruthy();
    expect(screen.getByRole('table', { name: '商城会员名单' })).toBeTruthy();
    releaseRefresh?.();
    await waitFor(() => expect(screen.getByRole('button', { name: '刷新会员名单' })).toBeTruthy());
  });

  it('switches between the full directory and the selected member view without exposing internal identity fields', async () => {
    const user = userEvent.setup();
    renderRoute();
    const row = await screen.findByRole('row', { name: '查看会员 测试消费者' });

    expect(row.getAttribute('aria-expanded')).toBe('false');
    await user.click(row);

    const detail = screen.getByRole('complementary', { name: '会员详情' });
    expect(detail.getAttribute('aria-hidden')).toBe('false');
    expect(screen.getByRole('heading', { level: 2, name: '会员详情' })).toBeTruthy();
    expect(await within(detail).findByText('测试商城')).toBeTruthy();
    expect(within(detail).getByRole('tab', { name: '个人资料' }).getAttribute('aria-selected')).toBe('true');
    expect(within(detail).getByText('手机已绑定')).toBeTruthy();
    expect(within(detail).getByText('微信已绑定')).toBeTruthy();
    expect(screen.queryByText('membership:storefront:test')).toBeNull();

    await user.click(screen.getByRole('button', { name: '全屏查看会员目录' }));
    expect(detail.getAttribute('aria-hidden')).toBe('true');
  });

  it('reads scoped invitation relations and personal orders through dedicated member profile APIs', async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('row', { name: '查看会员 测试消费者' }));
    const detail = screen.getByRole('complementary', { name: '会员详情' });

    await user.click(within(detail).getByRole('tab', { name: '邀请关系' }));
    expect(await within(detail).findByText('邀请人丙')).toBeTruthy();
    expect(within(detail).getByText('测试消费者乙')).toBeTruthy();
    const inviteeRequest = requests.find(({ url }) => url.endsWith('/invitees?limit=10'));
    expect(inviteeRequest?.url).toContain(encodeURIComponent('membership:storefront:test'));
    await user.click(within(detail).getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(new URL(requests.at(-1)!.url).searchParams.get('cursor')).toBe('cursor:invitees'));
    expect(within(detail).getByText('第 2 页')).toBeTruthy();
    await user.click(within(detail).getByRole('button', { name: '上一页' }));
    expect(within(detail).queryByText('第 2 页')).toBeNull();

    await user.click(within(detail).getByRole('tab', { name: '个人订单' }));
    expect(await within(detail).findByText('HT20260906001')).toBeTruthy();
    expect(within(detail).getByText('¥129.00')).toBeTruthy();
    expect(within(detail).getByText('已支付')).toBeTruthy();
    expect(within(detail).getByText('已发货')).toBeTruthy();
    await user.click(within(detail).getByRole('button', { name: /HT20260906001/ }));
    expect(screen.getByLabelText('当前测试路径').textContent).toContain('/orders/order%3Atarget');
    expect(screen.queryByText(/member:shared|membership:storefront:test/)).toBeNull();
  });

  it('keeps member identity visible on detail failure and renders an honest empty order state', async () => {
    const user = userEvent.setup();
    server.use(http.get('*/api/v1/member/storefront-members/:membershipid', () => HttpResponse.json({
      code: 'UPSTREAM_UNAVAILABLE', message: '会员档案暂不可用', requestId: 'request:detail',
    }, { status: 503 })));
    const failed = renderRoute();
    await user.click(await screen.findByRole('row', { name: '查看会员 测试消费者' }));
    const detail = screen.getByRole('complementary', { name: '会员详情' });
    expect(await within(detail).findByText(/会员档案暂不可用|UPSTREAM_UNAVAILABLE/)).toBeTruthy();
    expect(within(detail).getByText('测试消费者')).toBeTruthy();
    failed.unmount();

    server.resetHandlers();
    server.use(
      http.get('*/api/v1/member/storefront-members/:membershipid', () => HttpResponse.json({
        ...memberDetail, order_count: 0, latest_order_at: null,
      })),
      http.get('*/api/v1/member/storefront-members/:membershipid/orders', () => HttpResponse.json({ items: [], count: 0 })),
    );
    renderRoute();
    await user.click(await screen.findByRole('row', { name: '查看会员 测试消费者' }));
    await user.click(screen.getByRole('tab', { name: '个人订单' }));
    expect(await screen.findByText('该会员暂无订单')).toBeTruthy();
    expect(screen.getByText('暂无')).toBeTruthy();
  });

  it('filters the current page by real WeChat binding state', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole('table', { name: '商城会员名单' });

    await user.click(screen.getByRole('button', { name: '微信未绑定' }));
    expect(await screen.findByText('当前页没有符合此绑定状态的会员。')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '微信已绑定' }));
    expect(await screen.findByRole('row', { name: '查看会员 测试消费者' })).toBeTruthy();
  });

  it('shows the real empty and error states without fallback rows', async () => {
    server.use(http.get('*/api/v1/member/storefront-members', () => HttpResponse.json({ items: [], count: 0 })));
    const empty = renderRoute();
    expect(await screen.findByText('暂无数据')).toBeTruthy();
    expect(screen.queryByText('测试消费者')).toBeNull();
    empty.unmount();

    server.use(http.get('*/api/v1/member/storefront-members', () => HttpResponse.json({
      code: 'UPSTREAM_UNAVAILABLE', message: '名单暂不可用', requestId: 'request:test',
    }, { status: 503 })));
    renderRoute();
    expect(await screen.findByText(/名单暂不可用|UPSTREAM_UNAVAILABLE/)).toBeTruthy();
    expect(screen.queryByText('测试消费者')).toBeNull();
  });

  it('defines desktop split motion, narrow-screen slide motion and reduced-motion fallback', () => {
    const css = readFileSync('src/feature/storefront-member/storefront-member.css', 'utf8');
    expect(css).toMatch(/\.storefrontmemberstage\[data-detail-open='true'\][\s\S]*grid-template-columns:/);
    expect(css).toMatch(/@media \(max-width: 75rem\)[\s\S]*data-detail-open='true'[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*translateX\(34px\)/);
    expect(css).toMatch(/@media \(max-width: 42rem\)[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none !important;/);
  });
});

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/storefront-members']}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}><Component /></ConsoleContextProvider>
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="当前测试路径" hidden>{location.pathname}{location.search}</output>;
}

const context: ConsoleContext = {
  session: {
    actor: 'principal:operator', membership: 'membership:operator', accessVersion: 9,
    permissions: ['member.read'], capabilities: [
      'member.storefront.members.read',
      'member.storefront.detail.read',
      'member.storefront.invitees.read',
      'member.storefront.orders.read',
    ], target: 'console',
    scope: { kind: 'mall', id: 'mall:test', name: '测试商城' },
    scopes: [{ kind: 'mall', id: 'mall:test', name: '测试商城' }],
    assurance: { level: 1 }, syncedAt: '2026-09-07T08:00:00.000Z',
  },
  profile: { display_name: '商城管理员', employee_no: null },
  scope: { kind: 'mall', id: 'mall:test', name: '测试商城' },
  scopes: [{ kind: 'mall', id: 'mall:test', name: '测试商城' }],
};

const memberPage = {
  items: [{
    membership_id: 'membership:storefront:test', display_name: '测试消费者', mobile_masked: '188****8866',
    identity_level: 'L6', identity_kind: 'consumer', membership_status: 'active', mobile_bound: true,
    wechat_bound: true, joined_at: '2026-09-06T08:00:00.000Z',
  }],
  count: 1,
  nextCursor: 'cursor:next',
} as const;

const memberDetail = {
  ...memberPage.items[0],
  inviter: {
    display_name: '邀请人丙', mobile_masked: '155****5544', bound_at: '2026-09-05T08:00:00.000Z',
    expires_at: null, relationship_status: 'active',
  },
  invited_count: 1,
  order_count: 1,
  latest_order_at: '2026-09-06T10:00:00.000Z',
} as const;

const inviteePage = {
  items: [{
    membership_id: 'membership:storefront:invitee', display_name: '测试消费者乙', mobile_masked: '177****7755',
    membership_status: 'active', bound_at: '2026-09-06T09:00:00.000Z', expires_at: null,
    relationship_status: 'active',
  }],
  count: 1,
  nextCursor: 'cursor:invitees',
} as const;

const orderPage = {
  items: [{
    id: 'order:target', order_number: 'HT20260906001', total_minor: '12900', currency: 'CNY',
    payment_state: 'paid', fulfillment_state: 'shipped', aftersale_state: 'none',
    created_at: '2026-09-06T10:00:00.000Z',
  }],
  count: 1,
} as const;
