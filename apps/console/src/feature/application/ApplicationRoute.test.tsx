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
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { cleanup(); server.resetHandlers(); writes.length = 0; currentSearch = ''; });
afterAll(() => server.close());

describe('Commerce application workspace', () => {
  it('renders application governance for platform scope and opens a read-only record', async () => {
    const user = userEvent.setup();
    renderRoute('/applications', scope('platform', 'platform:preview', '智慧翼平台'));
    expect(await screen.findByRole('heading', { level: 1, name: '应用治理' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '应用治理列表' })).toBeTruthy();
    expect(screen.getByText('平台治理视角：智慧翼平台')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '查看鸿泰惠民通摘要' }));
    const drawer = await screen.findByRole('dialog', { name: '鸿泰惠民通' });
    expect(within(drawer).getByText(/不会提交任何写操作/)).toBeTruthy();
    expect(writes).toHaveLength(0);
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
    renderRoute('/applications?campaign=keep', scope('platform', 'platform:preview', '智慧翼平台'));
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
    renderRoute('/applications?campaign=keep', scope('platform', 'platform:preview', '智慧翼平台'));
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

function LocationProbe() {
  currentSearch = useLocation().search;
  return null;
}

function renderRoute(entry: string, activeScope: ConsoleScope) {
  const context = contextFor(activeScope);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter initialEntries={[entry]}><QueryClientProvider client={client}>
    <ConsoleContextProvider value={context}><LocationProbe /><Component /></ConsoleContextProvider>
  </QueryClientProvider></MemoryRouter>);
}

function scope(kind: ConsoleScope['kind'], id: string, name: string): ConsoleScope {
  return { kind, id, name };
}

function contextFor(activeScope: ConsoleScope): ConsoleContext {
  return {
    session: {
      actor: 'actor:commerce', membership: 'membership:commerce', accessVersion: 11,
      permissions: ['experience.application.read'], capabilities: ['experience.applications.read'], target: 'console',
      scope: activeScope, scopes: [activeScope], assurance: { level: 2 }, syncedAt: '2026-08-27T05:00:00.000Z',
    },
    profile: { display_name: '商城运营', employee_no: null },
    scope: activeScope,
    scopes: [activeScope],
  };
}

const applications = {
  items: [
    { id: 'application:benefits', code: 'BENEFITS', public_slug: 'benefits', name: '鸿泰惠民通', status: 'active', version: 12,
      head_sequence: 8, head_validation_state: 'valid', published_sequence: 8, domain: 'benefits.example.cn',
      mall_id: 'mall:benefits', pool_id: 'pool:benefits', updated_at: '2026-08-27T04:00:00.000Z' },
    { id: 'application:select', code: 'SELECT', public_slug: 'select', name: '鸿泰甄选', status: 'draft', version: 5,
      head_sequence: 5, head_validation_state: 'invalid', published_sequence: 3, domain: 'select.example.cn',
      mall_id: 'mall:select', pool_id: 'pool:select', updated_at: '2026-08-27T03:00:00.000Z' },
  ],
  count: 2,
};
