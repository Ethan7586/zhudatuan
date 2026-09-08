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
    expect(screen.getAllByText('静序').length).toBeGreaterThan(0);
    expect(screen.getAllByText('域名正常').length).toBeGreaterThan(0);
    expect(screen.queryByText(/建店方案/)).toBeNull();

    await user.click(screen.getByRole('button', { name: '查看鸿泰惠民通详情' }));
    const drawer = await screen.findByRole('dialog', { name: '鸿泰惠民通' });
    expect(await within(drawer).findByText(/列表保持轻量/)).toBeTruthy();
    expect(within(drawer).getByText('鸿泰福利')).toBeTruthy();
    expect(within(drawer).getByText('静序')).toBeTruthy();
    expect(within(drawer).getAllByText('域名正常')).toHaveLength(2);
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

  it('submits the complete mall profile through the canonical organization operation', async () => {
    const user = userEvent.setup();
    let request: Request | undefined;
    server.use(
      http.get('*/api/v1/organizations/layers', () =>
        HttpResponse.json({
          items: [{ id: 'enterprise:hongtai', kind: 'enterprise', parent_id: 'tenant:one', parent_name: '示范租户', name: '鸿泰集团', timezone: 'Asia/Shanghai', status: 'active', version: 7 }],
          count: 1,
        })
      ),
      http.post('*/api/v1/organization/malls', ({ request: incoming }) => {
        request = incoming.clone();
        return HttpResponse.json(createdMall());
      })
    );
    renderRoute('/applications', scope('enterprise', 'enterprise:hongtai', '鸿泰集团'), 3);
    await screen.findByRole('table', { name: '集团商城列表' });
    await user.click(screen.getByRole('button', { name: '创建商城' }));
    const dialog = await screen.findByRole('dialog', { name: '创建商城' });
    await user.click(within(dialog).getByRole('button', { name: '继续' }));
    await user.type(await within(dialog).findByLabelText('商城名称'), '员工温暖商城');
    await user.type(within(dialog).getByLabelText('商城代码'), 'WARM_MALL');
    await user.type(within(dialog).getByLabelText('公开路径'), 'warm-mall');
    await user.type(within(dialog).getByLabelText('品牌名称'), '鸿泰温暖福利');
    await user.click(within(dialog).getByRole('button', { name: '继续' }));

    await user.selectOptions(within(dialog).getByLabelText('主体类型'), 'personal');
    await user.type(within(dialog).getByLabelText('联系人手机'), '13812345678');
    await user.type(within(dialog).getByLabelText('主营类目'), '员工福利');
    await user.type(within(dialog).getByLabelText('经营地区'), '上海市');
    await user.type(within(dialog).getByLabelText('经营地址'), '幸福路 1 号');
    const groups = within(dialog).getByRole('navigation', { name: '开店资料分组' });
    await user.click(within(groups).getByRole('button', { name: /支付与履约/ }));
    await user.type(within(dialog).getByLabelText('默认发货地区'), '上海市');
    await user.type(within(dialog).getByLabelText('退货联系人'), '商城售后 13812345678');
    await user.type(within(dialog).getByLabelText('默认退货地址'), '幸福路 1 号');
    await user.type(within(dialog).getByLabelText('经营通知接收人'), 'ops@hongtai.example');
    await user.click(within(dialog).getByRole('button', { name: '继续' }));
    await user.click(within(dialog).getByRole('checkbox', { name: /核对商城归属/ }));
    await user.click(within(dialog).getByRole('button', { name: '确认创建商城' }));

    expect(await within(dialog).findByText(/正在由后台可靠初始化/)).toBeTruthy();
    expect(request?.headers.get('if-match')).toBe('"7"');
    await expect(request?.json()).resolves.toMatchObject({
      parentId: 'enterprise:hongtai',
      name: '员工温暖商城',
      code: 'WARM_MALL',
      publicSlug: 'warm-mall',
      theme: { preset: 'shop' },
      opening: {
        subject: { type: 'personal', companyName: '鸿泰集团', contactMobile: '+8613812345678' },
        business: { primaryCategory: '员工福利', region: '上海市', address: '幸福路 1 号' },
        fulfillment: { deliveryMode: 'express', warehouseRegion: '上海市' },
        notificationContact: 'ops@hongtai.example',
      },
    });
  });

  it('copies only the saved decoration into a selected existing mall', async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.post('*/api/v1/experiences/applications/:applicationid/copies', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...applications.items[1], versionId: 'version:copy' });
      })
    );
    renderRoute('/applications', scope('enterprise', 'enterprise:hongtai', '鸿泰集团'), 3);
    const table = await screen.findByRole('table', { name: '集团商城列表' });
    await user.click(within(table).getAllByRole('button', { name: '复制' })[0]!);
    const dialog = await screen.findByRole('form', { name: '复制商城' });
    await user.click(within(dialog).getByRole('checkbox', { name: /核对商城范围/ }));
    await user.click(within(dialog).getByRole('button', { name: '确认复制' }));
    expect(await within(dialog).findByText(/装修草稿已复制到目标商城/)).toBeTruthy();
    expect(body).toEqual({ targetMallId: 'mall:select', reason: '控制台复制商城装修草稿' });
  });

  it('keeps mall navigation titles and URL-backed read filters stable', async () => {
    const user = userEvent.setup();
    renderRoute('/applications?campaign=keep', scope('mall', 'mall:hongtai-benefits', '鸿泰惠民通'));
    expect(await screen.findByRole('heading', { level: 1, name: '店铺装修' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '店铺装修应用' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '进入装修' }).hasAttribute('disabled')).toBe(false);

    await user.type(screen.getByRole('searchbox', { name: '搜索商城应用' }), '甄选');
    expect(screen.getByRole('button', { name: '查看鸿泰甄选详情' })).toBeTruthy();
    expect(screen.getByText('东方策展')).toBeTruthy();
    expect(screen.getByText('发布异常')).toBeTruthy();
    expect(screen.queryByText('鸿泰惠民通')).toBeNull();
    expect(new URLSearchParams(currentSearch).get('campaign')).toBe('keep');
    await user.click(screen.getByRole('button', { name: '已发布' }));
    await waitFor(() => expect(new URLSearchParams(currentSearch).get('view')).toBe('published'));
  });

  it('autosaves a controlled component, validates the immutable version and publishes only after confirmation', async () => {
    const user = userEvent.setup();
    let detailReads = 0;
    const operations: string[] = [];
    const document = {
      version: 2,
      application: 'application:benefits',
      theme: { preset: 'shop', primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
      navigation: [{ id: 'navigation:home', label: '首页', page: 'application:benefits:home' }],
      assets: [],
      pages: [
        {
          id: 'application:benefits:home',
          path: 'home',
          blocks: [
            { id: 'hero', component: 'hero', content: { title: '鸿泰惠民通', subtitle: '企业福利，温暖抵达' } },
            { id: 'notice', component: 'notice', content: { announcement: '欢迎进入企业福利商城' } },
          ],
        },
      ],
    };
    const version = {
      id: 'version:new',
      application_id: 'application:benefits',
      sequence: 9,
      schema_version: '2',
      configuration: document,
      configuration_hash: 'b'.repeat(64),
      validation_state: 'valid',
      validation_issues: [],
      reason: '控制台商城装修发布',
      created_by: 'actor:commerce',
      created_at: '2026-09-03T00:01:00.000Z',
    };
    const previous = { ...version, id: 'version:previous', sequence: 8, reason: '上一版装修' };
    server.use(
      http.get('*/api/v1/experiences/applications/:applicationid', () => {
        detailReads += 1;
        const saved = operations.includes('save');
        const published = operations.includes('publish');
        return HttpResponse.json({
          ...applications.items[0],
          version: saved ? 13 : 12,
          head: saved ? version : previous,
          published: published ? version : previous,
          history: [
            {
              id: saved ? version.id : previous.id,
              sequence: saved ? version.sequence : previous.sequence,
              schemaVersion: '2',
              validationState: 'valid',
              reason: '当前装修',
              createdAt: '2026-09-03T00:01:00.000Z',
              lifecycle: published ? 'published' : 'draft',
            },
            { id: 'version:history', sequence: 7, schemaVersion: '2', validationState: 'valid', reason: '历史装修', createdAt: '2026-09-02T00:01:00.000Z', lifecycle: 'published' },
          ],
        });
      }),
      http.post('*/api/v1/experiences/applications/:applicationid/versions', async ({ request }) => {
        const body = (await request.json()) as { configuration: typeof document };
        expect(body.configuration.pages[0]?.blocks[0]?.content.title).toBe('更新后的福利首页');
        operations.push('save');
        return HttpResponse.json(version);
      }),
      http.post('*/api/v1/experiences/versions/:versionid/validation', () => {
        operations.push('validate');
        return HttpResponse.json({ id: version.id, application_id: version.application_id, validation_state: 'valid', issues: [] });
      }),
      http.put('*/api/v1/experiences/versions/:versionid/publication', ({ request }) => {
        operations.push('publish');
        expect(request.headers.get('x-action-proof')).toBeNull();
        expect(request.headers.get('if-match')).toBe('"13"');
        return HttpResponse.json({
          id: 'release:new',
          application_id: version.application_id,
          version_id: version.id,
          pool_id: 'pool:benefits',
          state: 'active',
          effective_at: '2026-09-03T00:02:00.000Z',
          retired_at: null,
          published_by: 'actor:commerce',
        });
      })
    );
    renderRoute('/applications', scope('mall', 'mall:hongtai-benefits', '鸿泰惠民通'), 3);
    await screen.findByRole('table', { name: '店铺装修应用' });
    await user.click(screen.getByRole('button', { name: '进入装修' }));
    await screen.findByRole('dialog', { name: '商城装修' });
    await user.click(screen.getByRole('button', { name: '编辑主视觉' }));
    const title = screen.getByLabelText('主标题');
    await user.clear(title);
    await user.type(title, '更新后的福利首页');
    await waitFor(() => expect(operations).toContain('save'));
    await user.click(screen.getByRole('button', { name: '校验版本' }));
    await waitFor(() => expect(operations).toContain('validate'));
    await user.click(screen.getByRole('button', { name: '预览已保存版' }));
    expect(screen.getByText(/正在预览不可变的第 9 版/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '返回编辑' }));
    await user.click(screen.getByRole('checkbox', { name: /核对预览/ }));
    await user.click(screen.getByRole('button', { name: '发布已校验版' }));
    expect(await screen.findByText(/已校验版本发布成功/)).toBeTruthy();
    expect(operations).toEqual(['save', 'validate', 'publish']);
    expect(detailReads).toBeGreaterThanOrEqual(3);
  });

  it('locates a server validation issue and keeps every responsive workspace control reachable', async () => {
    const user = userEvent.setup();
    const document = experienceDocument('待校验首页', '');
    const head = experienceVersion('version:validation', 9, document, 'pending');
    server.use(
      http.get('*/api/v1/experiences/applications/:applicationid', () => HttpResponse.json({ ...applications.items[0], version: 12, head, published: null, history: [] })),
      http.post('*/api/v1/experiences/versions/:versionid/validation', () =>
        HttpResponse.json({ id: head.id, application_id: head.application_id, validation_state: 'invalid', issues: [{ code: 'NOTICE_REQUIRED', path: 'pages.0.blocks.1.content.announcement', message: '请填写商城公告' }] })
      )
    );
    renderRoute('/applications', scope('mall', 'mall:hongtai-benefits', '鸿泰惠民通'), 3);
    await screen.findByRole('table', { name: '店铺装修应用' });
    await user.click(screen.getByRole('button', { name: '进入装修' }));
    const designer = await screen.findByRole('dialog', { name: '商城装修' });
    const workspace = within(designer).getByRole('navigation', { name: '装修工作区' });
    for (const label of ['页面', '组件', '画布', '属性']) expect(within(workspace).getByRole('button', { name: label })).toBeTruthy();
    const devices = within(designer).getByRole('navigation', { name: '画布尺寸' });
    for (const label of ['桌面', '平板', '手机']) expect(within(devices).getByRole('button', { name: label })).toBeTruthy();
    await user.click(within(devices).getByRole('button', { name: '手机' }));
    expect(within(devices).getByRole('button', { name: '手机' }).getAttribute('aria-pressed')).toBe('true');

    await user.click(within(designer).getByRole('button', { name: '校验版本' }));
    const issue = await within(designer).findByText('请填写商城公告');
    await user.click(issue.closest('button')!);
    expect(within(designer).getByLabelText('公告内容')).toBeTruthy();
    expect(within(workspace).getByRole('button', { name: '属性' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('restores history as a new version, validates it and republishes atomically', async () => {
    const user = userEvent.setup();
    const operations: string[] = [];
    const current = experienceVersion('version:current', 9, experienceDocument('当前首页', '当前公告'), 'valid');
    const source = experienceVersion('version:history', 7, experienceDocument('历史首页', '历史公告'), 'valid');
    const restored = experienceVersion('version:restored', 10, source.configuration, 'pending');
    let restoredReady = false;
    let published = false;
    let restoreMatch = '';
    let publishMatch = '';
    server.use(
      http.get('*/api/v1/experiences/applications/:applicationid', () => {
        const head = restoredReady ? restored : current;
        return HttpResponse.json({
          ...applications.items[0],
          version: restoredReady ? 13 : 12,
          head,
          published: published ? restored : current,
          history: [
            { id: head.id, sequence: head.sequence, schemaVersion: '2', validationState: head.validation_state, reason: head.reason, createdAt: head.created_at, lifecycle: published ? 'published' : 'draft' },
            { id: source.id, sequence: source.sequence, schemaVersion: '2', validationState: 'valid', reason: '历史装修', createdAt: source.created_at, lifecycle: 'published' },
          ],
        });
      }),
      http.post('*/api/v1/experiences/versions/:versionid/restorations', ({ request }) => {
        restoreMatch = request.headers.get('if-match') ?? '';
        operations.push('restore');
        restoredReady = true;
        return HttpResponse.json(restored);
      }),
      http.post('*/api/v1/experiences/versions/:versionid/validation', () => {
        operations.push('validate');
        return HttpResponse.json({ id: restored.id, application_id: restored.application_id, validation_state: 'valid', issues: [] });
      }),
      http.put('*/api/v1/experiences/versions/:versionid/publication', ({ request }) => {
        publishMatch = request.headers.get('if-match') ?? '';
        operations.push('publish');
        published = true;
        return HttpResponse.json({
          id: 'release:restored',
          application_id: restored.application_id,
          version_id: restored.id,
          pool_id: 'pool:benefits',
          state: 'active',
          effective_at: '2026-09-07T00:05:00.000Z',
          retired_at: null,
          published_by: 'actor:commerce',
        });
      })
    );
    renderRoute('/applications', scope('mall', 'mall:hongtai-benefits', '鸿泰惠民通'), 3);
    await screen.findByRole('table', { name: '店铺装修应用' });
    await user.click(screen.getByRole('button', { name: '进入装修' }));
    const designer = await screen.findByRole('dialog', { name: '商城装修' });
    await user.selectOptions(within(designer).getByLabelText('历史版本'), source.id);
    await user.click(within(designer).getByRole('button', { name: '恢复并发布' }));
    expect(await within(designer).findByText(/历史版本已恢复为新版本并重新发布/)).toBeTruthy();
    expect(operations).toEqual(['restore', 'validate', 'publish']);
    expect(restoreMatch).toBe('"12"');
    expect(publishMatch).toBe('"13"');
  });

  it('shows field differences and never overwrites a concurrent editor', async () => {
    const user = userEvent.setup();
    let conflicted = false;
    const baseDocument = {
      version: 2 as const,
      application: 'application:benefits',
      theme: { preset: 'shop' as const, primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
      navigation: [{ id: 'navigation:home', label: '首页', page: 'application:benefits:home' }],
      assets: [],
      pages: [{ id: 'application:benefits:home', path: 'home', blocks: [{ id: 'hero', component: 'hero' as const, content: { title: '原始标题', subtitle: '企业福利，温暖抵达' } }] }],
    };
    const currentDocument = {
      ...baseDocument,
      pages: [{ ...baseDocument.pages[0]!, blocks: [{ ...baseDocument.pages[0]!.blocks[0]!, content: { title: '同事刚保存的标题', subtitle: '企业福利，温暖抵达' } }] }],
    };
    const version = (id: string, sequence: number, configuration: typeof baseDocument) => ({
      id,
      application_id: 'application:benefits',
      sequence,
      schema_version: '2',
      configuration,
      configuration_hash: 'c'.repeat(64),
      validation_state: 'pending',
      validation_issues: [],
      reason: '自动保存草稿',
      created_by: 'actor:commerce',
      created_at: '2026-09-03T00:03:00.000Z',
    });
    server.use(
      http.get('*/api/v1/experiences/applications/:applicationid', () => {
        const head = conflicted ? version('version:current', 10, currentDocument) : version('version:base', 9, baseDocument);
        return HttpResponse.json({ ...applications.items[0], version: conflicted ? 13 : 12, head, published: null, history: [] });
      }),
      http.post('*/api/v1/experiences/applications/:applicationid/versions', () => {
        conflicted = true;
        return HttpResponse.json({ code: 'VERSION_CONFLICT', message: 'state changed', requestId: 'request:conflict', retryable: false }, { status: 409 });
      })
    );
    renderRoute('/applications', scope('mall', 'mall:hongtai-benefits', '鸿泰惠民通'), 3);
    await screen.findByRole('table', { name: '店铺装修应用' });
    await user.click(screen.getByRole('button', { name: '进入装修' }));
    await user.click(await screen.findByRole('button', { name: '编辑主视觉' }));
    const title = screen.getByLabelText('主标题');
    await user.clear(title);
    await user.type(title, '我的待保存标题');

    const conflict = await screen.findByText('检测到其他人的新版本', {}, { timeout: 4_000 });
    const panel = conflict.closest('section')!;
    expect(within(panel).getByText('我的待保存标题')).toBeTruthy();
    expect(within(panel).getByText('同事刚保存的标题')).toBeTruthy();
    expect(within(panel).getAllByText(/同字段冲突/).length).toBeGreaterThan(0);
    expect(within(panel).getByRole<HTMLButtonElement>('button', { name: '安全合并并保存' }).disabled).toBe(true);

    await user.click(within(panel).getByRole('button', { name: '载入最新版本' }));
    expect(screen.queryByText('检测到其他人的新版本')).toBeNull();
    await user.click(screen.getByRole('button', { name: '编辑主视觉' }));
    expect(screen.getByLabelText<HTMLInputElement>('主标题').value).toBe('同事刚保存的标题');
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
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={contextFor(activeScope, assurance)}>
            <StepupProvider controller={{ request: () => undefined }}>
              <LocationProbe />
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
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
      permissions: ['experience.application.read', 'experience.application.manage', 'experience.version.manage', 'experience.version.publish', 'organization.layer.read', 'organization.mall.read', 'organization.mall.manage'],
      capabilities: [
        'experience.applications.read',
        'experience.applications.detail.read',
        'experience.applications.create',
        'experience.applications.copy',
        'experience.applications.update',
        'experience.versions.save',
        'experience.versions.validate',
        'experience.versions.publish',
        'experience.versions.restore',
        'organization.layers.read',
        'organization.malls.create',
        'organization.malls.read',
        'organization.malls.update',
      ],
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
      mallName: '鸿泰惠民通',
      brandName: '鸿泰福利',
      code: 'BENEFITS',
      publicSlug: 'benefits',
      name: '鸿泰惠民通',
      status: 'active',
      version: 12,
      headSequence: 8,
      publishedSequence: 8,
      theme: { preset: 'shop', primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
      domain: { mode: 'platform', address: 'http://127.0.0.1:3000/s/benefits', state: 'ready' },
      entry: { handle: 'benefits', url: 'http://127.0.0.1:3000/s/benefits', state: 'ready', releaseId: 'release:benefits:8', releaseVersion: 'experienceversion:benefits:8', contentHash: 'a'.repeat(64) },
      updatedAt: '2026-08-27T04:00:00.000Z',
    },
    {
      id: 'application:select',
      mallId: 'mall:select',
      mallName: '鸿泰甄选',
      brandName: '鸿泰甄选',
      code: 'SELECT',
      publicSlug: 'select',
      name: '鸿泰甄选',
      status: 'draft',
      version: 5,
      headSequence: 5,
      publishedSequence: 3,
      theme: { preset: 'market', primaryColor: '#A23B32', accentColor: '#C99A45', logoObjectRef: null, faviconObjectRef: null },
      domain: { mode: 'custom', address: 'select.hongtai.example', state: 'invalid' },
      entry: { handle: 'select', url: 'http://127.0.0.1:3000/s/select', state: 'invalid', requestId: 'trace:select' },
      updatedAt: '2026-08-27T03:00:00.000Z',
    },
  ],
  count: 2,
};

function createdMall() {
  return {
    id: 'mall:warm',
    parentId: 'enterprise:hongtai',
    name: '员工温暖商城',
    code: 'WARM_MALL',
    publicSlug: 'warm-mall',
    brandName: '鸿泰温暖福利',
    domain: { mode: 'platform' },
    ownerMembershipId: 'membership:commerce',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    theme: { preset: 'shop', primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
    opening: {
      state: 'complete',
      subject: { type: 'personal', companyName: '鸿泰集团', creditCode: null, legalRepresentative: null, contactName: '商城运营', contactMobile: '+8613812345678', licenseObjectRef: null },
      business: { storeType: 'general', primaryCategory: '员工福利', mode: 'selfoperated', region: '上海市', address: '幸福路 1 号', servicePhone: null },
      certificateMode: 'managed',
      certificateObjectRef: null,
      channels: { miniProgramMode: 'later', miniProgramAppId: null, miniProgramOriginalId: null, officialAccountMode: 'later', officialAccountAppId: null, videoChannelId: null },
      payment: { plan: 'later', wechatMerchantId: null },
      fulfillment: { deliveryMode: 'express', warehouseRegion: '上海市', returnContact: '商城售后 13812345678', returnAddress: '幸福路 1 号' },
      invoiceMode: 'later',
      notificationContact: 'ops@hongtai.example',
    },
    status: 'draft',
    version: 1,
    createdAt: '2026-09-07T00:00:00.000Z',
    updatedAt: '2026-09-07T00:00:00.000Z',
  };
}

function experienceDocument(title: string, announcement: string) {
  return {
    version: 2 as const,
    application: 'application:benefits',
    theme: { preset: 'shop' as const, primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
    navigation: [{ id: 'navigation:home', label: '首页', page: 'application:benefits:home' }],
    assets: [],
    pages: [
      {
        id: 'application:benefits:home',
        path: 'home',
        blocks: [
          { id: 'hero', component: 'hero' as const, content: { title, subtitle: '企业福利，温暖抵达' } },
          { id: 'notice', component: 'notice' as const, content: { announcement } },
        ],
      },
    ],
  };
}

function experienceVersion(id: string, sequence: number, configuration: ReturnType<typeof experienceDocument>, validation: 'pending' | 'valid' | 'invalid') {
  return {
    id,
    application_id: 'application:benefits',
    sequence,
    schema_version: '2' as const,
    configuration,
    configuration_hash: 'd'.repeat(64),
    validation_state: validation,
    validation_issues: [],
    reason: '商城装修版本',
    created_by: 'actor:commerce',
    created_at: '2026-09-07T00:04:00.000Z',
  };
}
