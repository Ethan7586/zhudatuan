import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { Component } from './ExperienceRoute';

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
});
afterAll(() => server.close());

describe('Experience governance workspace', () => {
  it('renders platform application governance and a read-only authoritative record', async () => {
    const user = userEvent.setup();
    renderRoute('/applications', scope('platform', 'platform:commerce', '智慧翼平台'));
    expect(await screen.findByRole('heading', { level: 1, name: '应用治理' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '应用治理列表' })).toBeTruthy();
    expect(screen.getByText('平台治理视角：智慧翼平台')).toBeTruthy();
    expect(screen.queryByText(/建店方案/)).toBeNull();

    await user.click(screen.getByRole('button', { name: '查看鸿泰惠民通摘要' }));
    const drawer = await screen.findByRole('dialog', { name: '鸿泰惠民通' });
    expect(within(drawer).getByText(/当前抽屉只读/)).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it('preserves the enterprise management UI and exposes the implemented creation flow', async () => {
    renderRoute('/applications', scope('enterprise', 'enterprise:hongtai', '鸿泰集团'));
    expect(await screen.findByRole('heading', { level: 1, name: '商城管理' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '集团商城列表' })).toBeTruthy();
    expect(screen.getByText('商城创建与初始草稿已启用')).toBeTruthy();
    expect(screen.getByText('装修呈现以当前已发布版本为准')).toBeTruthy();
    expect(screen.queryByText(/Experience 版本/)).toBeNull();
    expect(screen.getByRole('button', { name: '创建商城' }).hasAttribute('disabled')).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it('keeps mall navigation titles and URL-backed read filters stable', async () => {
    const user = userEvent.setup();
    renderRoute('/applications?campaign=keep', scope('mall', 'mall:hongtai-benefits', '鸿泰惠民通'));
    expect(await screen.findByRole('heading', { level: 1, name: '店铺装修' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '店铺装修应用' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '进入装修' }).hasAttribute('disabled')).toBe(false);

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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={contextFor(activeScope)}>
          <LocationProbe />
          <Component />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
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
      permissions: ['experience.application.read'],
      capabilities: ['experience.applications.read'],
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

const common = {
  scope_id: 'platform:commerce',
  created_at: '2026-08-20T04:00:00.000Z',
  head_schema_version: '2',
  head_configuration: null,
  head_reason: null,
  published_schema_version: '2',
  published_configuration: null,
  published_reason: null,
  history: [],
} as const;

const applications = {
  items: [
    {
      ...common,
      id: 'application:benefits',
      code: 'BENEFITS',
      public_slug: 'benefits',
      name: '鸿泰惠民通',
      status: 'active',
      version: 12,
      head_id: 'experienceversion:benefits:8',
      head_sequence: 8,
      head_validation_state: 'valid',
      head_created_at: '2026-08-27T04:00:00.000Z',
      published_id: 'experienceversion:benefits:8',
      published_sequence: 8,
      published_validation_state: 'valid',
      published_created_at: '2026-08-27T04:00:00.000Z',
      domain: 'benefits.example.cn',
      mall_id: 'mall:benefits',
      pool_id: 'pool:benefits',
      updated_at: '2026-08-27T04:00:00.000Z',
    },
    {
      ...common,
      id: 'application:select',
      code: 'SELECT',
      public_slug: 'select',
      name: '鸿泰甄选',
      status: 'draft',
      version: 5,
      head_id: 'experienceversion:select:5',
      head_sequence: 5,
      head_validation_state: 'invalid',
      head_reason: 'INVALID_CONFIGURATION',
      head_created_at: '2026-08-27T03:00:00.000Z',
      published_id: 'experienceversion:select:3',
      published_sequence: 3,
      published_validation_state: 'valid',
      published_created_at: '2026-08-25T03:00:00.000Z',
      domain: 'select.example.cn',
      mall_id: 'mall:select',
      pool_id: 'pool:select',
      updated_at: '2026-08-27T03:00:00.000Z',
    },
  ],
  count: 2,
};
