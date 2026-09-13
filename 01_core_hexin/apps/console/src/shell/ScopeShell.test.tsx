import { SCOPE_KINDS } from '@shop/authz';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ConsoleContext, ConsoleScope } from '../entity/session/ConsoleSession';
import { consoleModules } from '../route/ConsoleModuleRegistry';
import {
  deepestConsoleRouteHandle,
  isConsoleRouteHandle,
  materializeConsoleModules,
  resolveConsoleRoutePresentation,
} from '../route/ConsoleModuleRoutes';
import { ScopeShell, WorkspaceRouteLoading } from './ScopeShell';

const materializedRoutes = materializeConsoleModules(consoleModules);
const entryOperations = consoleModules.flatMap((module) => module.routes.find(({ kind }) => kind === 'entry')?.operations ?? []);
const enterpriseScope: ConsoleScope = { kind: 'enterprise', id: 'enterprise:1', name: '鸿泰集团' };
const mallScope: ConsoleScope = { kind: 'mall', id: 'mall:1', name: '鸿泰商城' };
const context: ConsoleContext = {
  session: {
    actor: 'actor:1',
    membership: 'membership:1',
    accessVersion: 7,
    permissions: [],
    capabilities: entryOperations,
    target: 'console',
    scope: enterpriseScope,
    scopes: [enterpriseScope, mallScope],
    assurance: { level: 1 },
    syncedAt: '2026-08-26T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: enterpriseScope,
  scopes: [enterpriseScope, mallScope],
};

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ScopeShell route handles', () => {
  it('keeps lazy supply-chain navigation visibly identified while its route chunk loads', () => {
    render(<WorkspaceRouteLoading moduleId="supply-chain" />);
    expect(screen.getByRole('status').textContent).toContain('正在打开供应链管理');
    expect(screen.getByText('正在准备供货伙伴、商品和库存数据')).toBeTruthy();
  });

  it('derives every entry and representative child/detail/technical owner from the deepest handle', () => {
    for (const module of consoleModules) {
      const entry = module.routes.find(({ kind }) => kind === 'entry');
      expect(entry, module.id).toBeDefined();
      if (entry !== undefined) expect(matchedModuleId(entry.path)).toBe(module.id);
    }

    expect([
      ['finance/entries', matchedModuleId('finance/entries')],
      ['settings/members', matchedModuleId('settings/members')],
      ['settings/notification', matchedModuleId('settings/notification')],
      ['referral/promotion', matchedModuleId('referral/promotion')],
      ['products/:productId', matchedModuleId('products/:productId')],
      ['orders/:orderId', matchedModuleId('orders/:orderId')],
      ['support/:caseId?', matchedModuleId('support/:caseId?')],
      ['imports/member/:jobId', matchedModuleId('imports/member/:jobId')],
      ['imports/catalog/:jobId', matchedModuleId('imports/catalog/:jobId')],
      ['imports/voucher/:jobId', matchedModuleId('imports/voucher/:jobId')],
    ]).toEqual([
      ['finance/entries', 'finance'],
      ['settings/members', 'access'],
      ['settings/notification', 'qualification'],
      ['referral/promotion', 'referral'],
      ['products/:productId', 'products'],
      ['orders/:orderId', 'orders'],
      ['support/:caseId?', 'support'],
      ['imports/member/:jobId', 'access'],
      ['imports/catalog/:jobId', 'products'],
      ['imports/voucher/:jobId', 'vouchers'],
    ]);
  });

  it('preserves all application scope presentations from manifest data', () => {
    const presentation = handleForPath('applications').presentation;
    for (const kind of SCOPE_KINDS) {
      const resolved = resolveConsoleRoutePresentation(presentation, kind);
      if (kind === 'platform' || kind === 'distributor' || kind === 'tenant') {
        expect(resolved).toEqual({
          title: '应用治理',
          summary: '跨商城查看应用、版本、发布状态、域名绑定与治理异常。',
        });
      } else if (kind === 'mall') {
        expect(resolved).toEqual({
          title: '店铺装修',
          summary: '管理页面、模板、导航、预览和发布，让当前商城形成完整消费入口。',
        });
      } else {
        expect(resolved).toEqual({
          title: '商城管理',
          summary: '创建、复制、进入和管理集团旗下商城，并跟踪开店与发布进度。',
        });
      }
    }
  });

  it('renders manifest presentation and active owner through real useMatches data', async () => {
    const { container } = renderShell('/scopes/enterprise/enterprise%3A1/applications');

    expect((await screen.findAllByText('商城管理')).length).toBeGreaterThan(0);
    expect(await screen.findByText('创建、复制、进入和管理集团旗下商城，并跟踪开店与发布进度。')).toBeTruthy();
    expect((await screen.findByRole('button', { name: '商城管理' })).getAttribute('aria-current')).toBe('page');
    expect(container.querySelector('.consolelayout')?.getAttribute('data-route')).toBe('applications');
    expect(container.querySelector('.consolelayout')?.getAttribute('data-visual-geometry')).toBe('straight');
    await waitFor(() => expect(document.title).toBe('商城管理 · 鸿泰集团'));
  });

  it('uses distributed platform preferredScopeKind from registry navigation when opening the module', async () => {
    const user = userEvent.setup();
    const { router } = renderShell('/scopes/enterprise/enterprise%3A1/applications');

    await user.click(await screen.findByRole('button', { name: '分布式平台' }));
    await waitFor(() => expect(router.state.location.pathname)
      .toBe('/scopes/mall/mall%3A1/platforms'));
  });

  it('omits business modules that the current session cannot enter', async () => {
    renderShell('/scopes/enterprise/enterprise%3A1/applications', {
      ...context,
      session: { ...context.session, capabilities: ['catalog.listings.read'] },
    });

    expect(await screen.findByRole('button', { name: '商品管理' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '财务与对账台' })).toBeNull();
    expect(screen.queryByRole('button', { name: '生意看板' })).toBeNull();
    expect(screen.getByRole('button', { name: '个人中心：测试运营' })).toBeTruthy();
  });

  it('keeps unknown/profile-like matches outside the business module owner model', async () => {
    expect(deepestConsoleRouteHandle([{ handle: undefined }, { handle: { kind: 'profile' } }])).toBeUndefined();
    const { container } = renderShell('/scopes/enterprise/enterprise%3A1/unknown');
    await waitFor(() => expect(container.querySelector('.consolebreadcrumb strong')?.textContent).toBe('页面不存在'));
    expect(container.querySelector('.consolelayout')?.hasAttribute('data-route')).toBe(false);
  });

  it('does not retain pathname catalogs, hardcoded owner Sets, or ApplicationScope at runtime', () => {
    const source = readFileSync('src/shell/ScopeShell.tsx', 'utf8');
    expect(source).toContain('useMatches()');
    expect(source).toContain("cancelQueries({ queryKey: ['console'], type: 'active' })");
    expect(source).toContain("preloadConsoleModule(moduleId, 'idle')");
    expect(source).not.toMatch(/professionalRouteFromPath|workstationFromPath|new Set\(|ApplicationScope/);
  });
});

function matchedModuleId(path: string): string | undefined {
  return deepestConsoleRouteHandle([
    { handle: undefined },
    { handle: handleForPath(path) },
  ])?.moduleId;
}

function handleForPath(path: string) {
  const handle = materializedRoutes.find((route) => route.path === path)?.handle;
  if (!isConsoleRouteHandle(handle)) throw new Error(`Missing Console route handle for ${path}`);
  return handle;
}

function renderShell(initialEntry: string, loadedContext: ConsoleContext = context) {
  const router = createMemoryRouter([{
    path: '/scopes/:scopeKind/:scopeId',
    loader: () => loadedContext,
    Component: ScopeShell,
    children: [
      { path: 'applications', Component: FixturePage, handle: handleForPath('applications') },
      { path: 'platforms', Component: FixturePage, handle: handleForPath('platforms') },
      { path: 'referral/settings', Component: FixturePage, handle: handleForPath('referral/settings') },
      { path: 'settings/profile', Component: FixturePage },
      { path: '*', Component: UnknownPage },
    ],
  }], { initialEntries: [initialEntry] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...rendered, router };
}

function FixturePage() {
  return <h1>页面内容</h1>;
}

function UnknownPage() {
  return <h1>页面不存在</h1>;
}
