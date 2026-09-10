import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './StorefrontMemberRoute';

const requests: Request[] = [];
let holdRefresh = false;
let releaseRefresh: (() => void) | undefined;
const server = setupServer(http.get('*/api/v1/member/storefront-members', async ({ request }) => {
  requests.push(request.clone());
  if (holdRefresh) await new Promise<void>((resolve) => { releaseRefresh = resolve; });
  return HttpResponse.json(memberPage);
}));

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
    expect(within(detail).getByText('测试商城')).toBeTruthy();
    expect(screen.queryByText('membership:storefront:test')).toBeNull();

    await user.click(screen.getByRole('button', { name: '全屏查看会员目录' }));
    expect(detail.getAttribute('aria-hidden')).toBe('true');
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
    expect(css).toMatch(/@media \(max-width: 75rem\)[\s\S]*translateX\(34px\)/);
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
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const context: ConsoleContext = {
  session: {
    actor: 'principal:operator', membership: 'membership:operator', accessVersion: 9,
    permissions: ['member.read'], capabilities: ['member.storefront.members.read'], target: 'console',
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
