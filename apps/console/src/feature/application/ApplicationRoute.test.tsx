import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { Component } from './ApplicationRoute';
import { commerceSolutions, readCommerceSolution } from './CommerceSolutionCenter';

const writes: string[] = [];
const server = setupServer(
  http.get('*/api/v1/experiences/applications', () => HttpResponse.json(applications)),
  http.all('*/api/v1/experiences/**', ({ request }) => {
    writes.push(request.method);
    return HttpResponse.json({ code: 'UNEXPECTED_APPLICATION_WRITE' }, { status: 500 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  writes.length = 0;
  currentSearch = '';
});
afterAll(() => server.close());

describe('Commerce application workspace', () => {
  it('renders application governance for platform scope and opens a read-only record', async () => {
    const user = userEvent.setup();
    renderRoute('/applications', scope('platform', 'platform:preview', '主打团平台'));
    expect(await screen.findByRole('heading', { level: 1, name: '应用治理' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '应用治理列表' })).toBeTruthy();
    expect(screen.getByText('平台治理视角：主打团平台')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '查看鸿泰惠民通摘要' }));
    const drawer = await screen.findByRole('dialog', { name: '鸿泰惠民通' });
    expect(within(drawer).getByText(/不会提交任何写操作/)).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it('hides cached records and an open drawer when access is revoked', async () => {
    const user = userEvent.setup();
    const { client } = renderRoute('/applications', scope('platform', 'platform:preview', '主打团平台'));
    await screen.findByRole('table', { name: '应用治理列表' });
    await user.click(screen.getByRole('button', { name: '查看鸿泰惠民通摘要' }));
    expect(await screen.findByRole('dialog', { name: '鸿泰惠民通' })).toBeTruthy();

    server.use(http.get('*/api/v1/experiences/applications', () => HttpResponse.json({ code: 'APPLICATION_READ_DENIED', requestId: 'request:revoked' }, { status: 403 })));
    await client.invalidateQueries();

    const access = await screen.findByRole('region', { name: '没有权限' });
    await waitFor(() => expect(document.activeElement).toBe(access));
    expect(within(access).getByText('「应用治理」不可访问')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('table', { name: '应用治理列表' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: '应用治理' })).toBeNull();
    expect(screen.queryByText('平台治理视角：主打团平台')).toBeNull();
    expect(screen.queryByRole('button', { name: '刷新数据' })).toBeNull();
    expect(screen.queryByRole('button', { name: '创建商城' })).toBeNull();
  });

  it('shows the enterprise six-step bootstrap as a safe non-mutating preview', async () => {
    const user = userEvent.setup();
    renderRoute('/applications', scope('enterprise', 'enterprise:hongtai', '鸿泰集团'));
    expect(await screen.findByRole('heading', { level: 1, name: '商城管理' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '集团商城列表' })).toBeTruthy();
    expect(screen.getByText('建店提交等待 mall.bootstrap')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '创建商城' }));
    const dialog = await screen.findByRole('dialog', { name: '创建商城 · 六步安全预览' });
    expect(within(dialog).getByText('等待原子化 mall.bootstrap')).toBeTruthy();
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(6);
    expect(writes).toHaveLength(0);
  });

  it('creates an application through the generated command and rereads the authoritative list', async () => {
    const user = userEvent.setup();
    let created = false;
    let reads = 0;
    let submitted: Readonly<Record<string, unknown>> | undefined;
    let headers: Headers | undefined;
    server.use(
      http.get('*/api/v1/experiences/applications', () => {
        reads += 1;
        return HttpResponse.json(created ? { ...applications, items: [createdApplication, ...applications.items], count: 3 } : applications);
      }),
      http.post('*/api/v1/experiences/applications', async ({ request }) => {
        writes.push(request.method);
        submitted = (await request.json()) as Readonly<Record<string, unknown>>;
        headers = request.headers;
        created = true;
        return HttpResponse.json(createdApplication, { status: 201 });
      })
    );
    renderRoute('/applications', scope('platform', 'platform:preview', '主打团平台'));
    await screen.findByRole('table', { name: '应用治理列表' });

    await user.click(screen.getByRole('button', { name: '新建应用' }));
    const dialog = await screen.findByRole('dialog', { name: '新建应用' });
    expect(within(dialog).getByText(/不会创建商城、组织关系、商品池或装修版本/)).toBeTruthy();
    await user.type(within(dialog).getByRole('textbox', { name: '应用名称' }), '築店新应用');
    await user.type(within(dialog).getByRole('textbox', { name: '应用代码' }), 'NEW_APP');
    await user.type(within(dialog).getByRole('textbox', { name: '公开路径' }), 'new-app');
    await user.click(within(dialog).getByRole('button', { name: '创建应用' }));

    expect((await screen.findByRole('status')).textContent).toContain('应用创建成功');
    await waitFor(() => expect(reads).toBeGreaterThanOrEqual(2));
    expect(submitted).toEqual({ name: '築店新应用', code: 'NEW_APP', publicSlug: 'new-app' });
    expect(headers?.get('x-scope-hint')).toBe('platform:preview');
    expect(headers?.get('x-access-version')).toBe('11');
    expect(headers?.get('x-csrf-token')).toBe('csrf-token-1234567890');
    expect(headers?.get('idempotency-key')).toBeTruthy();
    expect(screen.getByText('築店新应用')).toBeTruthy();
    expect(writes).toEqual(['POST']);
  });

  it('edits only the name and sends the current expectedVersion', async () => {
    const user = userEvent.setup();
    let updated = false;
    let body: Readonly<Record<string, unknown>> | undefined;
    let match: string | null = null;
    server.use(
      http.get('*/api/v1/experiences/applications', () =>
        HttpResponse.json(
          updated
            ? {
                ...applications,
                items: applications.items.map((item) => (item.id === 'application:benefits' ? { ...item, name: '鸿泰惠民通新版', version: 13 } : item)),
              }
            : applications
        )
      ),
      http.patch('*/api/v1/experiences/applications/application%3Abenefits', async ({ request }) => {
        writes.push(request.method);
        body = (await request.json()) as Readonly<Record<string, unknown>>;
        match = request.headers.get('if-match');
        updated = true;
        return HttpResponse.json({ ...applications.items[0], name: '鸿泰惠民通新版', version: 13 });
      })
    );
    renderRoute('/applications', scope('platform', 'platform:preview', '主打团平台'));
    await screen.findByRole('table', { name: '应用治理列表' });

    const locationKey = currentLocationKey;
    await user.click(screen.getByRole('button', { name: '编辑鸿泰惠民通' }));
    const dialog = await screen.findByRole('dialog', { name: '编辑应用 · 鸿泰惠民通' });
    expect(currentLocationKey).toBe(locationKey);
    const name = within(dialog).getByRole('textbox', { name: '应用名称' });
    await user.clear(name);
    await user.type(name, '鸿泰惠民通新版');
    await user.click(within(dialog).getByRole('button', { name: '保存名称' }));

    expect((await screen.findByRole('status')).textContent).toContain('应用名称修改成功');
    expect(body).toEqual({ name: '鸿泰惠民通新版' });
    expect(match).toBe('"12"');
    expect(await screen.findByText('鸿泰惠民通新版')).toBeTruthy();
    expect(writes).toEqual(['PATCH']);
  });

  it('shows the explicit VERSION_CONFLICT refresh instruction', async () => {
    const user = userEvent.setup();
    server.use(
      http.patch('*/api/v1/experiences/applications/application%3Abenefits', ({ request }) => {
        writes.push(request.method);
        return HttpResponse.json({ code: 'VERSION_CONFLICT', message: 'stale application version', requestId: 'request:conflict' }, { status: 409 });
      })
    );
    renderRoute('/applications', scope('platform', 'platform:preview', '主打团平台'));
    await screen.findByRole('table', { name: '应用治理列表' });
    await user.click(screen.getByRole('button', { name: '编辑鸿泰惠民通' }));
    const dialog = await screen.findByRole('dialog', { name: '编辑应用 · 鸿泰惠民通' });
    await user.click(within(dialog).getByRole('button', { name: '保存名称' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('VERSION_CONFLICT · 数据已经变化，请刷新后重试。');
    expect(writes).toEqual(['PATCH']);
  });

  it('requires confirmation and disables with PATCH instead of DELETE', async () => {
    const user = userEvent.setup();
    let disabled = false;
    let body: Readonly<Record<string, unknown>> | undefined;
    let match: string | null = null;
    server.use(
      http.get('*/api/v1/experiences/applications', () =>
        HttpResponse.json(
          disabled
            ? {
                ...applications,
                items: applications.items.map((item) => (item.id === 'application:benefits' ? { ...item, status: 'disabled', version: 13 } : item)),
              }
            : applications
        )
      ),
      http.patch('*/api/v1/experiences/applications/application%3Abenefits', async ({ request }) => {
        writes.push(request.method);
        body = (await request.json()) as Readonly<Record<string, unknown>>;
        match = request.headers.get('if-match');
        disabled = true;
        return HttpResponse.json({ ...applications.items[0], status: 'disabled', version: 13 });
      })
    );
    renderRoute('/applications', scope('platform', 'platform:preview', '主打团平台'));
    await screen.findByRole('table', { name: '应用治理列表' });
    await user.click(screen.getByRole('button', { name: '停用鸿泰惠民通' }));
    const dialog = await screen.findByRole('dialog', { name: '停用应用 · 鸿泰惠民通' });
    expect(within(dialog).getByText(/历史版本和审计记录不会删除/)).toBeTruthy();
    expect(writes).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: '确认停用' }));

    expect((await screen.findByRole('status')).textContent).toContain('应用已停用');
    expect(body).toEqual({ status: 'disabled' });
    expect(match).toBe('"12"');
    expect(writes).toEqual(['PATCH']);
    expect(screen.queryByRole('button', { name: '停用鸿泰惠民通' })).toBeNull();
  });

  it('copies the source head with a new identity and rereads the list', async () => {
    const user = userEvent.setup();
    let copied = false;
    let body: Readonly<Record<string, unknown>> | undefined;
    let requestedPath = '';
    server.use(
      http.get('*/api/v1/experiences/applications', () =>
        HttpResponse.json(
          copied
            ? {
                ...applications,
                items: [copiedApplication, ...applications.items],
                count: 3,
              }
            : applications
        )
      ),
      http.post('*/api/v1/experiences/applications/application%3Abenefits/copies', async ({ request }) => {
        writes.push(request.method);
        requestedPath = new URL(request.url).pathname;
        body = (await request.json()) as Readonly<Record<string, unknown>>;
        copied = true;
        return HttpResponse.json({ ...copiedApplication, versionId: 'version:copy' }, { status: 201 });
      })
    );
    renderRoute('/applications', scope('platform', 'platform:preview', '主打团平台'));
    await screen.findByRole('table', { name: '应用治理列表' });
    await user.click(screen.getByRole('button', { name: '复制鸿泰惠民通' }));
    const dialog = await screen.findByRole('dialog', { name: '复制应用 · 鸿泰惠民通' });
    expect(within(dialog).getByText('v8')).toBeTruthy();
    await user.type(within(dialog).getByRole('textbox', { name: '副本名称' }), '鸿泰惠民通副本');
    await user.type(within(dialog).getByRole('textbox', { name: '新 code' }), 'BENEFITS_COPY');
    await user.type(within(dialog).getByRole('textbox', { name: '新 publicSlug' }), 'benefits-copy');
    await user.type(within(dialog).getByRole('textbox', { name: '复制原因' }), '验收复制');
    await user.click(within(dialog).getByRole('button', { name: '复制应用' }));

    expect((await screen.findByRole('status')).textContent).toContain('应用复制成功');
    expect(requestedPath).toBe('/api/v1/experiences/applications/application%3Abenefits/copies');
    expect(body).toEqual({ name: '鸿泰惠民通副本', code: 'BENEFITS_COPY', publicSlug: 'benefits-copy', reason: '验收复制' });
    expect(await screen.findByText('鸿泰惠民通副本')).toBeTruthy();
    expect(writes).toEqual(['POST']);
  });

  it('does not fabricate a copy when the source has no head version', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/v1/experiences/applications', () =>
        HttpResponse.json({
          items: [{ ...applications.items[1], head_sequence: null, head_validation_state: null }],
          count: 1,
        })
      )
    );
    renderRoute('/applications', scope('platform', 'platform:preview', '主打团平台'));
    await screen.findByRole('table', { name: '应用治理列表' });
    await user.click(screen.getByRole('button', { name: '复制鸿泰甄选' }));
    const dialog = await screen.findByRole('dialog', { name: '复制应用 · 鸿泰甄选' });

    expect(within(dialog).getByRole('alert').textContent).toContain('当前应用尚无可复制的草稿版本。');
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: '复制应用' }).disabled).toBe(true);
    expect(writes).toHaveLength(0);
  });

  it('keeps the three official solutions stable and maps the old preview aliases', () => {
    expect(commerceSolutions.map(({ id, name, path }) => ({ id, name, path }))).toEqual([
      { id: 'jingxu', name: '築店 · 静序', path: '/design-references/admin/first-design/preview.html?release=20260828-2' },
      { id: 'oriental', name: '築店 · 东方策展', path: '/design-references/admin/kaidian/dist/index.html?release=20260828-2' },
      { id: 'warm-workshop', name: '築店 · 暖筑工坊', path: '/demo/index.html' },
    ]);
    expect(readCommerceSolution('studio')).toBe('jingxu');
    expect(readCommerceSolution('editorial')).toBe('oriental');
    expect(readCommerceSolution('classic')).toBe('warm-workshop');
  });

  it('commits a candidate only after confirmation and preserves unrelated URL state', async () => {
    const user = userEvent.setup();
    renderRoute('/applications?campaign=keep', scope('platform', 'platform:preview', '主打团平台'));
    await screen.findByRole('table', { name: '应用治理列表' });

    await user.click(screen.getByRole('button', { name: '建店方案（3 套）' }));
    let dialog = await screen.findByRole('dialog', { name: '建店方案中心' });
    expect(within(dialog).getAllByRole('radio')).toHaveLength(3);
    expect(within(dialog).queryAllByRole('iframe')).toHaveLength(0);
    expect(within(dialog).getByRole('radio', { name: '设为预览方案：築店 · 静序' })).toBeTruthy();
    expect(within(dialog).getByRole('radio', { name: '设为预览方案：築店 · 东方策展' })).toBeTruthy();

    await user.click(within(dialog).getByRole('radio', { name: '设为预览方案：築店 · 暖筑工坊' }));
    expect(new URLSearchParams(currentSearch).get('solution')).toBeNull();
    expect(new URLSearchParams(currentSearch).get('campaign')).toBe('keep');
    expect(within(dialog).getByText(/待确认：築店 · 暖筑工坊/)).toBeTruthy();
    expect(writes).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(new URLSearchParams(currentSearch).get('solution')).toBeNull();

    await user.click(screen.getByRole('button', { name: '建店方案（3 套）' }));
    dialog = await screen.findByRole('dialog', { name: '建店方案中心' });
    await user.click(within(dialog).getByRole('radio', { name: '设为预览方案：築店 · 暖筑工坊' }));
    await user.click(within(dialog).getByRole('button', { name: '确认预览' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(new URLSearchParams(currentSearch).get('solution')).toBe('warm-workshop');
    expect(new URLSearchParams(currentSearch).get('campaign')).toBe('keep');
    expect(screen.getByRole('button', { name: /预览方案 · 築店 · 暖筑工坊/ })).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it('discards on Escape and loads only the requested original in the full preview', async () => {
    const user = userEvent.setup();
    renderRoute('/applications?campaign=keep', scope('platform', 'platform:preview', '主打团平台'));
    await screen.findByRole('table', { name: '应用治理列表' });

    await user.click(screen.getByRole('button', { name: '建店方案（3 套）' }));
    let dialog = await screen.findByRole('dialog', { name: '建店方案中心' });
    await user.click(within(dialog).getByRole('radio', { name: '设为预览方案：築店 · 东方策展' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(new URLSearchParams(currentSearch).get('solution')).toBeNull();

    await user.click(screen.getByRole('button', { name: '建店方案（3 套）' }));
    dialog = await screen.findByRole('dialog', { name: '建店方案中心' });
    const orientalRadio = within(dialog).getByRole('radio', { name: '设为预览方案：築店 · 东方策展' });
    const orientalCard = orientalRadio.closest('article');
    expect(orientalCard).not.toBeNull();
    const previewButton = within(orientalCard as HTMLElement).getByRole('button', { name: '查看完整方案' });
    await user.click(previewButton);

    const studio = await screen.findByRole('dialog', { name: '築店 · 东方策展' });
    const frame = within(studio).getByTitle('築店东方策展原版方案');
    expect(frame.getAttribute('src')).toBe('http://localhost:4174/design-references/admin/kaidian/dist/index.html?release=20260828-2');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('allow')).toBe('clipboard-write');

    await user.click(within(studio).getByRole('button', { name: '← 返回方案中心' }));
    const returnedDialog = await screen.findByRole('dialog', { name: '建店方案中心' });
    const returnedCard = within(returnedDialog).getByRole('radio', { name: '设为预览方案：築店 · 东方策展' }).closest('article');
    expect(returnedCard).not.toBeNull();
    const returnedPreviewButton = within(returnedCard as HTMLElement).getByRole('button', { name: '查看完整方案' });
    expect(document.activeElement).toBe(returnedPreviewButton);
    expect(writes).toHaveLength(0);
  });

  it('uses the mall design language and keeps URL-backed filters stable', async () => {
    const user = userEvent.setup();
    renderRoute('/applications?campaign=keep', scope('mall', 'mall:hongtai-benefits', '鸿泰惠民通'));
    expect(await screen.findByRole('heading', { level: 1, name: '店铺装修' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '店铺装修应用' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '进入装修' })).toBeTruthy();

    await user.type(screen.getByRole('searchbox', { name: '搜索商城应用' }), '甄选');
    expect(screen.getByText('鸿泰甄选')).toBeTruthy();
    expect(screen.queryByText('鸿泰惠民通')).toBeNull();
    expect(new URLSearchParams(currentSearch).get('campaign')).toBe('keep');
    await user.click(screen.getByRole('button', { name: '已发布' }));
    await waitFor(() => expect(new URLSearchParams(currentSearch).get('view')).toBe('published'));
  });
});

let currentSearch = '';
let currentLocationKey = '';

function LocationProbe() {
  const location = useLocation();
  currentSearch = location.search;
  currentLocationKey = location.key;
  return null;
}

function renderRoute(entry: string, activeScope: ConsoleScope) {
  const context = contextFor(activeScope);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <LocationProbe />
          <Component />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { ...rendered, client };
}

function scope(kind: ConsoleScope['kind'], id: string, name: string): ConsoleScope {
  return { kind, id, name };
}

function contextFor(activeScope: ConsoleScope): ConsoleContext {
  return {
    session: {
      actor: 'actor:commerce',
      membership: 'membership:commerce',
      accessVersion: 11,
      permissions: ['experience.application.read', 'experience.application.manage'],
      capabilities: ['experience.applications.read', 'experience.applications.create', 'experience.applications.update', 'experience.applications.copy'],
      csrf: 'csrf-token-1234567890',
      target: 'console',
      scope: activeScope,
      scopes: [activeScope],
      assurance: { level: 2 },
      syncedAt: '2026-08-27T05:00:00.000Z',
    },
    profile: { display_name: '商城运营', employee_no: null },
    scope: activeScope,
    scopes: [activeScope],
  };
}

const applications = {
  items: [
    {
      id: 'application:benefits',
      code: 'BENEFITS',
      public_slug: 'benefits',
      name: '鸿泰惠民通',
      status: 'active',
      version: 12,
      head_sequence: 8,
      head_validation_state: 'valid',
      published_sequence: 8,
      domain: 'benefits.example.cn',
      mall_id: 'mall:benefits',
      pool_id: 'pool:benefits',
      updated_at: '2026-08-27T04:00:00.000Z',
    },
    {
      id: 'application:select',
      code: 'SELECT',
      public_slug: 'select',
      name: '鸿泰甄选',
      status: 'draft',
      version: 5,
      head_sequence: 5,
      head_validation_state: 'invalid',
      published_sequence: 3,
      domain: 'select.example.cn',
      mall_id: 'mall:select',
      pool_id: 'pool:select',
      updated_at: '2026-08-27T03:00:00.000Z',
    },
  ],
  count: 2,
};

const createdApplication = {
  id: 'application:new',
  code: 'NEW_APP',
  public_slug: 'new-app',
  name: '築店新应用',
  status: 'draft',
  version: 0,
  head_sequence: null,
  head_validation_state: null,
  published_sequence: null,
  domain: null,
  mall_id: null,
  pool_id: null,
  updated_at: '2026-08-31T08:00:00.000Z',
};

const copiedApplication = {
  id: 'application:copy',
  code: 'BENEFITS_COPY',
  public_slug: 'benefits-copy',
  name: '鸿泰惠民通副本',
  status: 'draft',
  version: 0,
  head_sequence: 1,
  head_validation_state: 'valid',
  published_sequence: null,
  domain: null,
  mall_id: null,
  pool_id: null,
  updated_at: '2026-08-31T08:10:00.000Z',
};
