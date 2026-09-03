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
  http.post('*/api/v1/vouchers/cardlibraries', async ({ request }) => {
    writes.push(`${request.method}:${JSON.stringify(await request.json())}`);
    return HttpResponse.json({ id: 'cardpool:test', scope_id: 'platform:commerce', code_prefix: 'MVP2026', next_sequence: 1, provider: null, mode: 'generated', status: 'ready', version: 0 }, { status: 201 });
  }),
  http.put('*/api/v1/vouchers/programs/:programid', async ({ request, params }) => {
    writes.push(`${request.method}:${String(params.programid)}:${JSON.stringify(await request.json())}`);
    return HttpResponse.json({ id: String(params.programid), scope_id: 'platform:commerce', name: '中秋关怀券', value_minor: 8_800, default_valid_days: 180, currency: 'CNY', status: 'draft', approval_required: true, version: 1 });
  }),
  http.all('*/api/v1/vouchers/**', ({ request }) => {
    writes.push(request.method);
    return HttpResponse.json({ code: 'UNEXPECTED_VOUCHER_WRITE' }, { status: 500 });
  })
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
    expect(screen.getByRole('heading', { level: 1, name: '卡券中心' })).toBeTruthy();
    expect(screen.getByText('当前网站归属：鸿泰集团')).toBeTruthy();
    expect(screen.getByText('¥70.00')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '卡号库' }));
    expect(await screen.findByRole('table', { name: '卡号库' })).toBeTruthy();
    expect(new URLSearchParams(currentSearch).get('view')).toBe('libraries');
    expect(requests).toContain('/api/v1/vouchers/cardlibraries');
  });

  it('filters the current page, opens a read-only summary and keeps both creation commands distinct', async () => {
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
    const programCreator = await screen.findByRole('dialog', { name: '新建卡券' });
    await user.clear(within(programCreator).getByRole('textbox', { name: '卡券名称' }));
    await user.type(within(programCreator).getByRole('textbox', { name: '卡券名称' }), '中秋关怀券');
    await user.clear(within(programCreator).getByRole('textbox', { name: '面值（元）' }));
    await user.type(within(programCreator).getByRole('textbox', { name: '面值（元）' }), '88');
    await user.clear(within(programCreator).getByRole('textbox', { name: '有效天数' }));
    await user.type(within(programCreator).getByRole('textbox', { name: '有效天数' }), '180');
    await user.click(within(programCreator).getByRole('button', { name: '创建草稿' }));
    await waitFor(() => expect(writes[0]).toMatch(/^PUT:voucher-program:[0-9a-f-]+:{"name":"中秋关怀券","valueMinor":8800,"validityDays":180,"status":"draft","approvalRequired":true}$/));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '新建卡券' })).toBeNull());
    expect(new URLSearchParams(currentSearch).get('view')).toBe('programs');

    await user.click(screen.getByRole('button', { name: '新建卡号库' }));
    const libraryCreator = await screen.findByRole('dialog', { name: '新建卡号库' });
    await user.clear(within(libraryCreator).getByRole('textbox', { name: '卡号前缀' }));
    await user.type(within(libraryCreator).getByRole('textbox', { name: '卡号前缀' }), 'MVP2026');
    await user.click(within(libraryCreator).getByRole('button', { name: '确认创建' }));
    await waitFor(() => expect(writes[1]).toBe('POST:{"mode":"generated","prefix":"MVP2026","provider":null}'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '新建卡号库' })).toBeNull());
    expect(new URLSearchParams(currentSearch).get('view')).toBe('libraries');
  });
});

let currentSearch = '';

function LocationProbe() {
  currentSearch = useLocation().search;
  return null;
}

function renderRoute(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <LocationProbe />
          <Component />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const context: ConsoleContext = {
  session: {
    actor: 'actor:voucher',
    membership: 'membership:voucher',
    accessVersion: 7,
    permissions: ['voucher.program.read', 'voucher.program.manage', 'voucher.cardlibrary.read', 'voucher.cardlibrary.create'],
    capabilities: ['voucher.programs.read', 'voucher.programs.manage', 'voucher.cardlibraries.read', 'voucher.cardlibraries.create'],
    target: 'console',
    scope: { kind: 'platform', id: 'platform:commerce', name: '鸿泰集团' },
    scopes: [{ kind: 'platform', id: 'platform:commerce', name: '鸿泰集团' }],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token-at-least-sixteen-characters',
    syncedAt: '2026-08-27T05:00:00.000Z',
  },
  profile: { display_name: '测试卡券运营', employee_no: null },
  scope: { kind: 'platform', id: 'platform:commerce', name: '鸿泰集团' },
  scopes: [{ kind: 'platform', id: 'platform:commerce', name: '鸿泰集团' }],
};

const programs = {
  items: [
    { id: 'voucher-program:new-employee', scope_id: 'platform:commerce', name: '新员工入职礼包', value_minor: 3_000, currency: 'CNY', default_valid_days: 365, status: 'active', approval_required: true, version: 12, versions: [] },
    { id: 'voucher-program:summer-care', scope_id: 'platform:commerce', name: '夏季高温关怀券', value_minor: 4_000, currency: 'CNY', default_valid_days: 90, status: 'draft', approval_required: true, version: 7, versions: [] },
  ],
  count: 2,
};

const libraries = {
  items: [
    {
      id: 'cardlibrary:employee-202608',
      scope_id: 'platform:commerce',
      code_prefix: 'SW-EMP-2608',
      next_sequence: 5_001,
      provider: null,
      mode: 'generated',
      status: 'ready',
      version: 5,
      import_state: null,
      total_count: 5_000,
      success_count: 5_000,
      failure_count: 0,
      allocations: [],
      errors: [],
    },
  ],
  count: 1,
};
