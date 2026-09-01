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
  http.get('*/api/v1/experiences/applications/:applicationid', ({ params }) => {
    const record = applications.items.find((item) => item.id === params.applicationid);
    return record ? HttpResponse.json({ ...record, head: null, published: null, history: [] }) : HttpResponse.json({ code: 'RESOURCE_NOT_FOUND' }, { status: 404 });
  }),
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

    await user.click(screen.getByRole('button', { name: '查看鸿泰惠民通详情' }));
    const drawer = await screen.findByRole('dialog', { name: '鸿泰惠民通' });
    expect(await within(drawer).findByText(/列表保持轻量/)).toBeTruthy();
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

const applications = {
  items: [
    {
      id: 'application:benefits',
      mallId: 'mall:benefits',
      code: 'BENEFITS',
      publicSlug: 'benefits',
      name: '鸿泰惠民通',
      status: 'active',
      version: 12,
      headSequence: 8,
      publishedSequence: 8,
      entry: { handle: 'benefits', url: 'http://127.0.0.1:3000/s/benefits', state: 'ready', releaseId: 'release:benefits:8', releaseVersion: 'experienceversion:benefits:8', contentHash: 'a'.repeat(64) },
      updatedAt: '2026-08-27T04:00:00.000Z',
    },
    {
      id: 'application:select',
      mallId: 'mall:select',
      code: 'SELECT',
      publicSlug: 'select',
      name: '鸿泰甄选',
      status: 'draft',
      version: 5,
      headSequence: 5,
      publishedSequence: 3,
      entry: { handle: 'select', url: 'http://127.0.0.1:3000/s/select', state: 'invalid', requestId: 'trace:select' },
      updatedAt: '2026-08-27T03:00:00.000Z',
    },
  ],
  count: 2,
};
