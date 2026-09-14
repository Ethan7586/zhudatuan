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
let applicationItems = initialApplications();
let provisioningRequest: Readonly<{ scope: string | null; idempotencyKey: string | null; enterpriseId: string }> | undefined;
const server = setupServer(
  http.get('*/api/v1/experiences/applications', () => HttpResponse.json({ items: applicationItems, count: applicationItems.length })),
  http.post('*/api/v1/identity/stepup/challenges', () => {
    writes.push('identity.stepup.start');
    return HttpResponse.json({ id: 'challenge:mall-create', purpose: 'stepup', expires_at: '2026-09-01T23:59:00.000Z' }, { status: 202 });
  }),
  http.post('*/api/v1/identity/stepup/verifications', async ({ request }) => {
    const body = await request.json() as { challenge?: string; code?: string };
    if (body.challenge !== 'challenge:mall-create' || body.code !== '123456') return HttpResponse.json({ code: 'INVALID_CODE' }, { status: 400 });
    writes.push('identity.stepup.complete');
    return HttpResponse.json({ id: 'session:commerce', assurance_level: 3 });
  }),
  http.post('*/api/v1/provisioning/malls', async ({ request }) => {
    const body = await request.json() as { enterpriseId: string; name: string; code: string; publicSlug: string };
    writes.push('provisioning.malls.create');
    provisioningRequest = {
      scope: request.headers.get('x-scope-hint'),
      idempotencyKey: request.headers.get('idempotency-key'),
      enterpriseId: body.enterpriseId,
    };
    applicationItems = [{
      id: 'application:zhenxuan', code: body.code, public_slug: 'h6', name: body.name, status: 'draft', version: 0,
      head_sequence: 1, head_validation_state: 'valid', published_sequence: null, domain: 'h5',
      mall_id: 'mall:zhenxuan', pool_id: 'pool:zhenxuan', updated_at: '2026-09-01T23:20:00.000Z',
    }, ...applicationItems];
    return HttpResponse.json({
      mallId: 'mall:zhenxuan', enterpriseId: body.enterpriseId, applicationId: 'application:zhenxuan', poolId: 'pool:zhenxuan',
      code: body.code, publicSlug: 'h6', name: body.name, createdAt: '2026-09-14T03:00:00.000Z',
      state: 'ready', publicationState: 'draft', nodeTask: {
        schema_version: 'sfl.autonode-control-task-receipt.v1', task_id: 'task:mall:new', action: 'ACTIVATE',
        node_id: 'node:h6:l1', status: 'QUEUED', phase: 'QUEUED', progress: 0, plan_digest: null,
        activation_status: null, waiting_external: [], last_error: null,
        platform: { mall_id: 'mall:zhenxuan', application_id: 'application:zhenxuan', name: body.name, public_slug: 'h6' },
        result: null,
        events: [{ phase: 'QUEUED', message: '平台创建任务已进入执行队列', occurred_at: '2026-09-14T03:00:00.000Z' }],
        created_at: '2026-09-14T03:00:00.000Z', updated_at: '2026-09-14T03:00:00.000Z',
        started_at: null, finished_at: null,
      },
    }, { status: 201 });
  }),
  http.all('*/api/v1/experiences/**', ({ request }) => {
    writes.push(request.method);
    return HttpResponse.json({ code: 'UNEXPECTED_APPLICATION_WRITE' }, { status: 500 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  writes.length = 0;
  currentSearch = '';
  applicationItems = initialApplications();
  provisioningRequest = undefined;
});
afterAll(() => server.close());

describe('Commerce application workspace', () => {
  it('renders mall management for platform scope and opens a read-only record', async () => {
    const user = userEvent.setup();
    renderRoute('/applications', scope('platform', 'platform:preview', '智慧翼平台'));
    expect(await screen.findByRole('heading', { level: 1, name: '商城管理' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '商城列表' })).toBeTruthy();
    expect(screen.getByText('商城控制面：智慧翼平台')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '查看鸿泰惠民通摘要' }));
    const drawer = await screen.findByRole('dialog', { name: '鸿泰惠民通' });
    expect(within(drawer).getByText(/不会提交任何写操作/)).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it('creates a mall through platform scope after step-up and refreshes the mall list', async () => {
    const user = userEvent.setup();
    renderRoute('/applications', scope('enterprise', 'enterprise:hongtai', '鸿泰集团'));
    expect(await screen.findByRole('heading', { level: 1, name: '商城管理' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '商城列表' })).toBeTruthy();
    expect(screen.getByText('商城创建发动机已接通')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '创建商城' }));
    let dialog = await screen.findByRole('dialog', { name: '创建商城' });
    expect((within(dialog).getByRole('combobox', { name: '所属上级' }) as HTMLSelectElement).value).toBe('enterprise:hongtai');
    await user.type(within(dialog).getByRole('textbox', { name: '商城名称' }), '主打团甄选商城');
    await user.type(within(dialog).getByRole('textbox', { name: '商城代码' }), 'ZDT_SELECT');
    expect(within(dialog).getByText('h6.hbbtzn.com 起')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    await user.type(within(dialog).getByRole('textbox', { name: '企业／主体名称' }), '主打团科技有限公司');
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    expect(within(dialog).getByText(/h6\.hbbtzn\.com → h7\.hbbtzn\.com/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    await user.selectOptions(within(dialog).getAllByRole('combobox', { name: '接入方式' })[0]!, 'authorize');
    await user.type(within(dialog).getByRole('textbox', { name: '小程序 AppID' }), 'wx1234567890');
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    expect(within(dialog).getByText('主打团科技有限公司')).toBeTruthy();
    expect(within(dialog).getByText('h6.hbbtzn.com 起自动顺序分配')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '确认创建' }));

    dialog = await screen.findByRole('dialog', { name: '验证后创建商城' });
    await user.type(within(dialog).getByRole('textbox', { name: '六位验证码' }), '123456');
    await user.click(within(dialog).getByRole('button', { name: '验证并创建' }));

    dialog = await screen.findByRole('dialog', { name: '商城创建完成' });
    expect(within(dialog).getByText('mall:zhenxuan')).toBeTruthy();
    expect(within(dialog).getByText('控制器尚未返回')).toBeTruthy();
    expect(within(dialog).getByText('task:mall:new')).toBeTruthy();
    expect(within(dialog).getByText('草稿，等待店铺装修')).toBeTruthy();
    expect(writes).toEqual(['identity.stepup.start', 'identity.stepup.complete', 'provisioning.malls.create']);
    expect(provisioningRequest?.scope).toBe('organization-platform-root');
    expect(provisioningRequest?.enterpriseId).toBe('enterprise:hongtai');
    expect(provisioningRequest?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    await user.click(within(dialog).getByRole('button', { name: '完成' }));
    expect(await screen.findByText('主打团甄选商城')).toBeTruthy();
  });

  it('keeps the three official solutions stable and maps the old preview aliases', () => {
    expect(commerceSolutions.map(({ id, name, path }) => ({ id, name, path }))).toEqual([
      { id: 'jingxu', name: '築店 · 静序', path: '/design-references/admin/first-design/index.html?screen=editor' },
      { id: 'oriental', name: '築店 · 东方策展', path: '/design-references/admin/kaidian/dist/index.html' },
      { id: 'warm-workshop', name: '築店 · 暖筑工坊', path: '/demo/index.html' },
    ]);
    expect(readCommerceSolution('studio')).toBe('jingxu');
    expect(readCommerceSolution('editorial')).toBe('oriental');
    expect(readCommerceSolution('classic')).toBe('warm-workshop');
  });

  it('commits a candidate only after confirmation and preserves unrelated URL state', async () => {
    const user = userEvent.setup();
    renderRoute('/applications?campaign=keep', scope('platform', 'platform:preview', '智慧翼平台'));
    await screen.findByRole('table', { name: '商城列表' });

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
    renderRoute('/applications?campaign=keep', scope('platform', 'platform:preview', '智慧翼平台'));
    await screen.findByRole('table', { name: '商城列表' });

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
    expect(frame.getAttribute('src')).toBe(
      `${process.env.VITE_ZHUDIAN_SOLUTION_ORIGIN ?? 'http://localhost:4174'}/design-references/admin/kaidian/dist/index.html`,
    );
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
    await user.click(screen.getByRole('button', { name: '创建商城' }));
    const dialog = await screen.findByRole('dialog', { name: '创建商城' });
    expect((within(dialog).getByRole('combobox', { name: '所属上级' }) as HTMLSelectElement).value)
      .toBe('mall:hongtai-benefits');
  });
});

let currentSearch = '';

function LocationProbe() {
  currentSearch = useLocation().search;
  return null;
}

function renderRoute(entry: string, activeScope: ConsoleScope, options: Readonly<{ phoneMasked?: string | null }> = {}) {
  const base = contextFor(activeScope);
  const context = options.phoneMasked === undefined ? base : {
    ...base,
    session: {
      ...base.session,
      security: { hasLocalCredential: true, phoneMasked: options.phoneMasked, passwordChangedAt: null },
    },
    profile: { ...base.profile, mobile_bound: options.phoneMasked !== null },
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter initialEntries={[entry]}><QueryClientProvider client={client}>
    <ConsoleContextProvider value={context}><LocationProbe /><Component /></ConsoleContextProvider>
  </QueryClientProvider></MemoryRouter>);
}

function scope(kind: ConsoleScope['kind'], id: string, name: string): ConsoleScope {
  return { kind, id, name };
}

function contextFor(activeScope: ConsoleScope): ConsoleContext {
  const management = activeScope.kind === 'platform' || activeScope.kind === 'enterprise' || activeScope.kind === 'mall';
  const platform = activeScope.kind === 'platform' ? activeScope : scope('platform', 'organization-platform-root', '主打团平台');
  const scopes = management
    ? activeScope.kind === 'platform'
      ? [activeScope, scope('enterprise', 'enterprise:hongtai', '鸿泰集团')]
      : [platform, activeScope]
    : [activeScope];
  return {
    session: {
      actor: 'actor:commerce', membership: 'membership:commerce', accessVersion: 11,
      permissions: ['experience.application.read', ...(management ? ['organization.layer.manage'] : [])],
      capabilities: ['experience.applications.read', ...(management ? ['provisioning.malls.create'] : [])], target: 'console',
      scope: activeScope, scopes, assurance: { level: 2 }, csrf: 'csrf-token-for-console-tests', syncedAt: '2026-08-27T05:00:00.000Z',
    },
    profile: { display_name: '商城运营', employee_no: null },
    scope: activeScope,
    scopes,
  };
}

interface ApplicationFixture {
  readonly id: string;
  readonly code: string;
  readonly public_slug: string;
  readonly name: string;
  readonly status: string;
  readonly version: number;
  readonly head_sequence: number;
  readonly head_validation_state: string;
  readonly published_sequence: number | null;
  readonly domain: string | null;
  readonly mall_id: string;
  readonly pool_id: string;
  readonly updated_at: string;
}

function initialApplications(): ApplicationFixture[] {
  return [
    { id: 'application:benefits', code: 'BENEFITS', public_slug: 'benefits', name: '鸿泰惠民通', status: 'active', version: 12,
      head_sequence: 8, head_validation_state: 'valid', published_sequence: 8, domain: 'benefits.example.cn',
      mall_id: 'mall:benefits', pool_id: 'pool:benefits', updated_at: '2026-08-27T04:00:00.000Z' },
    { id: 'application:select', code: 'SELECT', public_slug: 'select', name: '鸿泰甄选', status: 'draft', version: 5,
      head_sequence: 5, head_validation_state: 'invalid', published_sequence: 3, domain: 'select.example.cn',
      mall_id: 'mall:select', pool_id: 'pool:select', updated_at: '2026-08-27T03:00:00.000Z' },
  ];
}
