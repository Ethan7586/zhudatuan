import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DependencyProvider } from '../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext, ConsoleScope } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
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

  it('publishes only after confirmation and proof, then rereads and shows a receipt', async () => {
    const user = userEvent.setup();
    let detailReads = 0;
    const operations: string[] = [];
    const document = { version: 2, application: 'application:benefits', pages: [{ id: 'application:benefits:home', path: 'home', blocks: [{ id: 'hero', component: 'hero', content: { title: '鸿泰惠民通', subtitle: '企业福利，温暖抵达' } }, { id: 'notice', component: 'notice', content: { announcement: '欢迎进入企业福利商城' } }] }] };
    const version = { id: 'version:new', application_id: 'application:benefits', sequence: 9, schema_version: '2', configuration: document, configuration_hash: 'b'.repeat(64), validation_state: 'valid', reason: '控制台商城装修发布', created_by: 'actor:commerce', created_at: '2026-09-03T00:01:00.000Z' };
    server.use(
      http.get('*/api/v1/experiences/applications/:applicationid', () => { detailReads += 1; return HttpResponse.json({ ...applications.items[0], head: version, published: version, history: [] }); }),
      http.post('*/api/v1/experiences/applications/:applicationid/versions', () => { operations.push('save'); return HttpResponse.json(version); }),
      http.post('*/api/v1/experiences/versions/:versionid/validation', () => { operations.push('validate'); return HttpResponse.json({ id: version.id, application_id: version.application_id, validation_state: 'valid' }); }),
      http.put('*/api/v1/experiences/versions/:versionid/publication', ({ request }) => { operations.push('publish'); expect(request.headers.get('x-action-proof')).toBe('p'.repeat(43)); expect(request.headers.get('if-match')).toBe('"12"'); return HttpResponse.json({ id: 'release:new', application_id: version.application_id, version_id: version.id, pool_id: 'pool:benefits', state: 'active', effective_at: '2026-09-03T00:02:00.000Z', retired_at: null, published_by: 'actor:commerce' }); })
    );
    renderRoute('/applications', scope('mall', 'mall:hongtai-benefits', '鸿泰惠民通'), 3);
    await screen.findByRole('table', { name: '店铺装修应用' });
    await user.click(screen.getByRole('button', { name: '进入装修' }));
    await screen.findByRole('form', { name: '商城装修' });
    expect(screen.getByRole('button', { name: '保存、校验并发布' }).hasAttribute('disabled')).toBe(true);
    await user.type(screen.getByLabelText('一次性复核凭证'), 'p'.repeat(43));
    await user.click(screen.getByRole('checkbox', { name: /核对预览/ }));
    await user.click(screen.getByRole('button', { name: '保存、校验并发布' }));
    expect(await screen.findByText(/装修版本已校验并发布/)).toBeTruthy();
    expect(operations).toEqual(['save', 'validate', 'publish']);
    expect(detailReads).toBeGreaterThanOrEqual(2);
  });
});

let currentSearch = '';

function LocationProbe() {
  currentSearch = useLocation().search;
  return null;
}

function renderRoute(entry: string, activeScope: ConsoleScope, assurance = 2) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}><ConsoleContextProvider value={contextFor(activeScope, assurance)}><StepupProvider controller={{ request: () => undefined }}><LocationProbe /><Component /></StepupProvider></ConsoleContextProvider></DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function scope(kind: ConsoleScope['kind'], id: string, name: string): ConsoleScope {
  return { kind, id, name };
}

function contextFor(activeScope: ConsoleScope, assurance = 2): ConsoleContext {
  return {
    session: {
      actor: 'actor:commerce',
      membership: 'membership:commerce',
      accessVersion: 11,
      permissions: ['experience.application.read', 'experience.application.manage', 'experience.version.manage', 'experience.version.publish'],
      capabilities: ['experience.applications.read', 'experience.applications.detail.read', 'experience.applications.create', 'experience.applications.copy', 'experience.applications.update', 'experience.versions.save', 'experience.versions.validate', 'experience.versions.publish', 'experience.versions.restore'],
      target: 'console',
      scope: activeScope,
      scopes: [activeScope],
      assurance: { level: assurance },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
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
