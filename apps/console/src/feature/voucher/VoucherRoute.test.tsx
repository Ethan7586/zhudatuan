import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './VoucherRoute';

const requests: string[] = [];
const writes: string[] = [];
const server = setupServer(
  http.get('*/api/v1/vouchers/programs', ({ request }) => {
    requests.push(new URL(request.url).pathname);
    return HttpResponse.json(programs);
  }),
  http.get('*/api/v1/vouchers/cardlibraries', ({ request }) => {
    requests.push(new URL(request.url).pathname);
    return HttpResponse.json(libraries);
  }),
  http.get('*/api/v1/vouchers/reserves', () => HttpResponse.json({ items: [], count: 0 })),
  http.get('*/api/v1/vouchers/batches', () => HttpResponse.json({ items: [], count: 0 })),
  http.all('*/api/v1/vouchers/**', ({ request }) => {
    writes.push(request.method);
    return HttpResponse.json({ code: 'UNEXPECTED_VOUCHER_WRITE' }, { status: 500 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  requests.length = 0;
  writes.length = 0;
  currentSearch = '';
});
afterAll(() => server.close());

describe('Voucher governance workspace', () => {
  it('renders the scoped program read model and switches tabs through the URL', async () => {
    const user = userEvent.setup();
    renderRoute('/vouchers');
    expect(await screen.findByRole('table', { name: '卡券方案' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '卡券治理台' })).toBeTruthy();
    expect(screen.getByText('当前网站归属：鸿泰集团')).toBeTruthy();
    expect(screen.getByText('¥70.00')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '卡号库' }));
    expect(await screen.findByRole('table', { name: '卡号库' })).toBeTruthy();
    expect(new URLSearchParams(currentSearch).get('view')).toBe('libraries');
    expect(requests).toContain('/api/v1/vouchers/cardlibraries');
  });

  it('filters the current page, opens a read-only summary and keeps the create flow non-mutating', async () => {
    const user = userEvent.setup();
    renderRoute('/vouchers?view=programs&campaign=keep');
    await screen.findByRole('table', { name: '卡券方案' });

    await user.type(screen.getByRole('searchbox', { name: '搜索当前卡券视图' }), '夏季');
    expect(screen.getByText('夏季高温关怀券')).toBeTruthy();
    expect(screen.queryByText('新员工入职礼包')).toBeNull();
    expect(new URLSearchParams(currentSearch).get('campaign')).toBe('keep');

    await user.click(screen.getByRole('button', { name: '查看夏季高温关怀券摘要' }));
    const drawer = await screen.findByRole('dialog', { name: '夏季高温关怀券' });
    expect(within(drawer).getByText(/不会直接提交写入/)).toBeTruthy();
    await user.click(within(drawer).getByRole('button', { name: '关闭卡券摘要' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: '新建卡券' }));
    const creator = await screen.findByRole('dialog', { name: '新建卡券 · 安全预览' });
    expect(within(creator).getByText(/当前不会创建方案/)).toBeTruthy();
    expect(writes).toHaveLength(0);
  });
<<<<<<< HEAD

  it('hides cached voucher data and an open drawer when access is revoked', async () => {
    const user = userEvent.setup();
    const { client } = renderRoute('/vouchers?view=programs');
    await screen.findByRole('table', { name: '卡券方案' });
    await user.click(screen.getByRole('button', { name: '查看夏季高温关怀券摘要' }));
    expect(await screen.findByRole('dialog', { name: '夏季高温关怀券' })).toBeTruthy();

    server.use(http.get('*/api/v1/vouchers/programs', () => HttpResponse.json(
      { code: 'VOUCHER_READ_DENIED', requestId: 'request:revoked' },
      { status: 403 },
    )));
    await client.invalidateQueries();

    const access = await screen.findByRole('region', { name: '没有权限' });
    await waitFor(() => expect(document.activeElement).toBe(access));
    expect(within(access).getByText('「卡券治理台」不可访问')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('table', { name: '卡券方案' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: '卡券治理台' })).toBeNull();
    expect(screen.queryByText('当前网站归属：鸿泰集团')).toBeNull();
    expect(screen.queryByText('¥70.00')).toBeNull();
    expect(screen.queryByRole('button', { name: '刷新数据' })).toBeNull();
    expect(screen.queryByRole('button', { name: '新建卡券' })).toBeNull();
  });
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
});

let currentSearch = '';

function LocationProbe() {
  currentSearch = useLocation().search;
  return null;
}

function renderRoute(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
<<<<<<< HEAD
  const rendered = render(
=======
  return render(
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <LocationProbe />
          <Component />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
<<<<<<< HEAD
  return { ...rendered, client };
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

const context: ConsoleContext = {
  session: {
    actor: 'actor:voucher', membership: 'membership:voucher', accessVersion: 7,
    permissions: ['voucher.program.read', 'voucher.cardlibrary.read'],
    capabilities: ['voucher.programs.read', 'voucher.cardlibraries.read'], target: 'console',
    scope: { kind: 'platform', id: 'platform:preview', name: '鸿泰集团' },
    scopes: [{ kind: 'platform', id: 'platform:preview', name: '鸿泰集团' }],
    assurance: { level: 2 }, syncedAt: '2026-08-27T05:00:00.000Z',
  },
  profile: { display_name: '测试卡券运营', employee_no: null },
  scope: { kind: 'platform', id: 'platform:preview', name: '鸿泰集团' },
  scopes: [{ kind: 'platform', id: 'platform:preview', name: '鸿泰集团' }],
};

const programs = {
  items: [
    { id: 'voucher-program:new-employee', name: '新员工入职礼包', value_minor: 3_000, currency: 'CNY', status: 'active', approval_required: true, version: 12 },
    { id: 'voucher-program:summer-care', name: '夏季高温关怀券', value_minor: 4_000, currency: 'CNY', status: 'draft', approval_required: true, version: 7 },
  ],
  count: 2,
};

const libraries = {
  items: [
    { id: 'cardlibrary:employee-202608', code_prefix: 'SW-EMP-2608', mode: 'generated', status: 'ready', version: 5,
      import_state: null, total_count: 5_000, success_count: 5_000, failure_count: 0 },
  ],
  count: 1,
};
