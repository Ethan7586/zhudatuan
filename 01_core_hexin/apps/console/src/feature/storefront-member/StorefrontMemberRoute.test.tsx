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
  http.get('*/api/v1/member/storefront-profile-config', ({ request }) => {
    requests.push(request.clone());
    return HttpResponse.json(profileConfig);
  }),
  http.put('*/api/v1/member/storefront-profile-config', async ({ request }) => {
    requests.push(request.clone());
    return HttpResponse.json(await request.json());
  }),
  http.get('*/api/v1/member/storefront-members/:membershipid/custom-profile', ({ request }) => {
    requests.push(request.clone());
    return HttpResponse.json(customProfile);
  }),
  http.put('*/api/v1/member/storefront-members/:membershipid/custom-profile', async ({ request }) => {
    requests.push(request.clone());
    const update = await request.json() as { custom_tag_ids: string[]; custom_field_values: unknown[] };
    return HttpResponse.json({ system_tags: customProfile.system_tags, ...update });
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
    expect(within(table).getByText('MB-4F9Q2A7R').closest('small')?.textContent).toContain('188****8866');
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
    expect(await within(detail).findByText('HT20260906001')).toBeTruthy();
    expect(within(detail).getByRole('tab', { name: '个人订单' }).getAttribute('aria-selected')).toBe('true');
    expect(within(detail).getByText('手机已绑定')).toBeTruthy();
    expect(within(detail).getAllByText('微信已绑定')).toHaveLength(1);
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

  it('shows real system tags and saves edited custom tags and all field controls', async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('row', { name: '查看会员 测试消费者' }));
    const detail = screen.getByRole('complementary', { name: '会员详情' });
    await user.click(within(detail).getByRole('tab', { name: '个人资料' }));
    expect(await within(detail).findByText('有效会员')).toBeTruthy();
    const region = within(detail).getByRole('textbox', { name: '地区' });
    await user.clear(region);
    await user.type(region, '华南');
    await user.click(within(detail).getByRole('checkbox', { name: '重点会员' }));
    await user.click(within(detail).getByRole('button', { name: '保存会员资料' }));
    await within(detail).findByRole('status', { name: '' });
    const saved = requests.find(({ method, url }) => method === 'PUT' && url.includes('/custom-profile'));
    expect(await saved?.json()).toMatchObject({ custom_tag_ids: [], custom_field_values: expect.arrayContaining([{ field_id: 'field:region', value: '华南' }]) });
  });

  it('keeps local custom-profile edits visible when save fails', async () => {
    server.use(http.put('*/api/v1/member/storefront-members/:membershipid/custom-profile', () => HttpResponse.json({ code: 'SAVE_FAILED', message: '保存失败' }, { status: 503 })));
    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('row', { name: '查看会员 测试消费者' }));
    await user.click(screen.getByRole('tab', { name: '个人资料' }));
    const region = await screen.findByRole('textbox', { name: '地区' });
    await user.clear(region);
    await user.type(region, '仍然保留');
    await user.click(screen.getByRole('button', { name: '保存会员资料' }));
    expect((await screen.findByRole('alert')).textContent).toContain('保存失败，修改内容仍保留');
    expect((region as HTMLInputElement).value).toBe('仍然保留');
  });

  it('renders honest custom-profile loading and empty configuration states', async () => {
    let release: (() => void) | undefined;
    server.use(http.get('*/api/v1/member/storefront-profile-config', async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return HttpResponse.json({ tags: [], fields: [] });
    }));
    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('row', { name: '查看会员 测试消费者' }));
    await user.click(screen.getByRole('tab', { name: '个人资料' }));
    expect(await screen.findByText('正在读取自定义档案…')).toBeTruthy();
    release?.();
    expect(await screen.findByText('当前商城尚未配置自定义标签')).toBeTruthy();
    expect(screen.getByText('当前商城尚未配置自定义字段')).toBeTruthy();
  });

  it('shows custom-profile load errors and retries both scoped reads', async () => {
    server.use(http.get('*/api/v1/member/storefront-profile-config', () => HttpResponse.json({
      code: 'PROFILE_UNAVAILABLE', message: '自定义档案失败',
    }, { status: 503 })));
    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('row', { name: '查看会员 测试消费者' }));
    await user.click(screen.getByRole('tab', { name: '个人资料' }));
    expect(await screen.findByText(/自定义档案暂不可用|PROFILE_UNAVAILABLE/)).toBeTruthy();
    server.use(http.get('*/api/v1/member/storefront-profile-config', () => HttpResponse.json(profileConfig)));
    await user.click(screen.getByRole('button', { name: '重新加载' }));
    expect(await screen.findByRole('textbox', { name: '地区' })).toBeTruthy();
  });

  it('adds and removes mall-level tag and field definitions before saving config', async () => {
    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('row', { name: '查看会员 测试消费者' }));
    await user.click(screen.getByRole('tab', { name: '个人资料' }));
    await user.click(await screen.findByRole('button', { name: '配置标签与字段' }));
    await user.click(screen.getByRole('button', { name: '添加标签' }));
    expect((screen.getByRole('textbox', { name: '标签 2 名称' }) as HTMLInputElement).value).toBe('新标签 2');
    await user.click(screen.getAllByRole('button', { name: '删除' })[1]!);
    await user.click(screen.getByRole('button', { name: '添加字段' }));
    expect(screen.getByRole('textbox', { name: '字段 8 名称' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '保存配置' }));
    await waitFor(() => expect(requests.some(({ method, url }) => method === 'PUT' && url.endsWith('/storefront-profile-config'))).toBe(true));
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
    csrf: 'csrf:test',
    permissions: ['member.read'], capabilities: [
      'member.storefront.members.read',
      'member.storefront.detail.read',
      'member.storefront.invitees.read',
      'member.storefront.orders.read',
      'member.storefront.config.read',
      'member.storefront.config.manage',
      'member.storefront.custom.read',
      'member.storefront.custom.manage',
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
    identity_display: { kind: 'member', code: 'MB-4F9Q2A7R', label: '会员身份', maskedMobile: '188****8866' },
  }],
  count: 1,
  nextCursor: 'cursor:next',
} as const;

const memberDetail = {
  ...memberPage.items[0],
  parent: { kind: 'member', display_name: '邀请人丙', identity_level: 'L6' },
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
    membership_status: 'active', identity_level: 'L7', bound_at: '2026-09-06T09:00:00.000Z', expires_at: null,
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

const profileConfig = {
  tags: [{ id: 'tag:vip', name: '重点会员', color: 'purple', sort_order: 0, enabled: true }],
  fields: [
    { id: 'field:region', name: '地区', type: 'text', options: [], sort_order: 0, enabled: true },
    { id: 'field:level', name: '会员等级', type: 'select', options: ['金卡', '银卡'], sort_order: 1, enabled: true },
    { id: 'field:interests', name: '兴趣', type: 'multiselect', options: ['母婴', '食品'], sort_order: 2, enabled: true },
    { id: 'field:visits', name: '到店次数', type: 'number', options: [], sort_order: 3, enabled: true },
    { id: 'field:birthday', name: '生日', type: 'date', options: [], sort_order: 4, enabled: true },
    { id: 'field:consent', name: '允许回访', type: 'switch', options: [], sort_order: 5, enabled: true },
    { id: 'field:remark', name: '备注', type: 'remark', options: [], sort_order: 6, enabled: true },
  ],
} as const;

const customProfile = {
  system_tags: [{ code: 'active_member', name: '有效会员' }, { code: 'wechat_bound', name: '微信已绑定' }],
  custom_tag_ids: ['tag:vip'],
  custom_field_values: [
    { field_id: 'field:region', value: '华东' },
    { field_id: 'field:level', value: '金卡' },
    { field_id: 'field:interests', value: ['母婴'] },
    { field_id: 'field:visits', value: 3 },
    { field_id: 'field:birthday', value: '1990-01-02' },
    { field_id: 'field:consent', value: true },
    { field_id: 'field:remark', value: '周末联系' },
  ],
} as const;
