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
import type { Application } from './ApplicationSchema';
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
  it('renders mall management for platform scope and opens a read-only record', async () => {
    const user = userEvent.setup();
    renderRoute('/applications', scope('platform', 'platform:preview', '主打团平台'));
    expect(await screen.findByRole('heading', { level: 1, name: '商城管理' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '商城列表' })).toBeTruthy();
    expect(screen.getByText('商城控制面：主打团平台')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '查看鸿泰惠民通摘要' }));
    const drawer = await screen.findByRole('dialog', { name: '鸿泰惠民通' });
    expect(within(drawer).getByText(/不会提交任何写操作/)).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it('hides cached records and an open drawer when access is revoked', async () => {
    const user = userEvent.setup();
    const { client } = renderRoute('/applications', scope('platform', 'platform:preview', '主打团平台'));
    await screen.findByRole('table', { name: '商城列表' });
    await user.click(screen.getByRole('button', { name: '查看鸿泰惠民通摘要' }));
    expect(await screen.findByRole('dialog', { name: '鸿泰惠民通' })).toBeTruthy();

    server.use(http.get('*/api/v1/experiences/applications', () => HttpResponse.json({ code: 'APPLICATION_READ_DENIED', requestId: 'request:revoked' }, { status: 403 })));
    await client.invalidateQueries();

    const access = await screen.findByRole('region', { name: '没有权限' });
    await waitFor(() => expect(document.activeElement).toBe(access));
    expect(within(access).getByText('「商城管理」不可访问')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('table', { name: '商城列表' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: '商城管理' })).toBeNull();
    expect(screen.queryByText('商城控制面：主打团平台')).toBeNull();
    expect(screen.queryByRole('button', { name: '刷新数据' })).toBeNull();
    expect(screen.queryByRole('button', { name: '创建商城' })).toBeNull();
  });

  it('creates an empty mall through platform scope after step-up and refreshes the mall list', async () => {
    const user = userEvent.setup();
    let items: Application[] = [...applications.items];
    let submitted: Readonly<Record<string, unknown>> | undefined;
    let headers: Headers | undefined;
    server.use(
      http.get('*/api/v1/experiences/applications', () => HttpResponse.json({ ...applications, items, count: items.length })),
      http.post('*/api/v1/identity/stepup/challenges', () => {
        writes.push('identity.stepup.start');
        return HttpResponse.json({ id: 'challenge:mall-create', purpose: 'stepup', expires_at: '2026-09-01T23:59:00.000Z' }, { status: 202 });
      }),
      http.post('*/api/v1/identity/stepup/verifications', async ({ request }) => {
        const body = await request.json() as { challenge?: string; code?: string };
        if (body.challenge !== 'challenge:mall-create' || body.code !== '123456') {
          return HttpResponse.json({ code: 'INVALID_CODE' }, { status: 400 });
        }
        writes.push('identity.stepup.complete');
        return HttpResponse.json({ id: 'session:commerce', assurance_level: 3 });
      }),
      http.post('*/api/v1/provisioning/malls', async ({ request }) => {
        headers = request.headers;
        submitted = await request.json() as Readonly<Record<string, unknown>>;
        writes.push('provisioning.malls.create');
        items = [{
          id: 'application:zhenxuan', code: String(submitted.code), public_slug: String(submitted.publicSlug),
          name: String(submitted.name), status: 'draft', version: 0, head_sequence: 1, head_validation_state: 'valid',
          published_sequence: null, domain: null, mall_id: 'mall:zhenxuan', pool_id: 'pool:zhenxuan',
          updated_at: '2026-09-01T23:20:00.000Z',
        }, ...items];
        return HttpResponse.json({
          mallId: 'mall:zhenxuan', enterpriseId: submitted.enterpriseId, applicationId: 'application:zhenxuan',
          poolId: 'pool:zhenxuan', code: submitted.code, publicSlug: submitted.publicSlug, name: submitted.name,
          state: 'ready', publicationState: 'draft',
        }, { status: 201 });
      }),
    );
    renderRoute('/applications', scope('enterprise', 'enterprise:hongtai', '鸿泰集团'));
    expect(await screen.findByRole('heading', { level: 1, name: '商城管理' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '商城列表' })).toBeTruthy();
    expect(screen.getByText('商城创建发动机已接通')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '创建商城' }));
    let dialog = await screen.findByRole('dialog', { name: '创建商城' });
    expect((within(dialog).getByRole('combobox', { name: '所属集团' }) as HTMLSelectElement).value).toBe('enterprise:hongtai');
    await user.type(within(dialog).getByRole('textbox', { name: '商城名称' }), '主打团甄选商城');
    await user.type(within(dialog).getByRole('textbox', { name: '商城代码' }), 'ZDT_SELECT');
    await user.type(within(dialog).getByRole('textbox', { name: '访问标识' }), 'zdt-select');
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    await user.type(within(dialog).getByRole('textbox', { name: '企业／主体名称' }), '主打团科技有限公司');
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '域名方案' }), 'custom');
    await user.type(within(dialog).getByRole('textbox', { name: '自有域名' }), 'shop.zhudatuan.com');
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    await user.selectOptions(within(dialog).getAllByRole('combobox', { name: '接入方式' })[0]!, 'authorize');
    await user.type(within(dialog).getByRole('textbox', { name: '小程序 AppID' }), 'wx1234567890');
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
    expect(within(dialog).getByText('主打团科技有限公司')).toBeTruthy();
    expect(within(dialog).getByText('shop.zhudatuan.com')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '确认创建' }));

    dialog = await screen.findByRole('dialog', { name: '验证后创建商城' });
    await user.type(within(dialog).getByRole('textbox', { name: '六位验证码' }), '123456');
    await user.click(within(dialog).getByRole('button', { name: '验证并创建' }));

    dialog = await screen.findByRole('dialog', { name: '商城创建完成' });
    expect(within(dialog).getByText('mall:zhenxuan')).toBeTruthy();
    expect(within(dialog).getByText('草稿，等待店铺装修')).toBeTruthy();
    expect(writes).toEqual(['identity.stepup.start', 'identity.stepup.complete', 'provisioning.malls.create']);
    expect(submitted).toEqual({ enterpriseId: 'enterprise:hongtai', name: '主打团甄选商城', code: 'ZDT_SELECT', publicSlug: 'zdt-select' });
    expect(headers?.get('x-scope-hint')).toBe('organization-platform-root');
    expect(headers?.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
    await user.click(within(dialog).getByRole('button', { name: '完成' }));
    expect(await screen.findByText('主打团甄选商城')).toBeTruthy();
  });

  it('guides an owner without a mobile through enrollment before mall creation', async () => {
    const user = userEvent.setup();
    const enrollmentCalls: string[] = [];
    server.use(
      http.post('*/api/v1/identity/stepup/challenges', () => HttpResponse.json({
        code: 'STEP_UP_DESTINATION_MISSING', message: 'No verified mobile is available.', requestId: 'request:no-mobile',
      }, { status: 409 })),
      http.post('*/api/v1/identity/password/verify', async ({ request }) => {
        enrollmentCalls.push('password.verify');
        expect(await request.json()).toEqual({ password: 'owner-password' });
        return HttpResponse.json({ verified: true, verifiedAt: '2026-09-02T04:00:00.000Z' });
      }),
      http.post('*/api/v1/identity/mobile/challenges', async ({ request }) => {
        enrollmentCalls.push('mobile.challenge');
        expect(await request.json()).toEqual({ destination: '+8613800138000' });
        return HttpResponse.json({
          id: 'challenge:mobile', purpose: 'phone_change', expires_at: '2026-09-02T04:10:00.000Z',
        }, { status: 202 });
      }),
      http.put('*/api/v1/identity/mobile', async ({ request }) => {
        enrollmentCalls.push('mobile.manage');
        expect(request.headers.get('x-access-version')).toBe('11');
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token-1234567890');
        expect(await request.json()).toEqual({
          mobile: '+8613800138000', challenge: 'challenge:mobile', code: '654321',
        });
        return HttpResponse.json({ id: 'member:owner', version: 2 });
      }),
    );

    renderRoute('/applications', scope('enterprise', 'enterprise:hongtai', '鸿泰集团'));
    await screen.findByRole('table', { name: '商城列表' });
    await user.click(screen.getByRole('button', { name: '创建商城' }));
    const dialog = await screen.findByRole('dialog', { name: '创建商城' });
    await user.type(within(dialog).getByRole('textbox', { name: '商城名称' }), '宏泰甄选');
    await user.type(within(dialog).getByRole('textbox', { name: '商城代码' }), 'HONGTAI');
    await user.type(within(dialog).getByRole('textbox', { name: '访问标识' }), 'hongtai');
    await advanceMallCreateJourney(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: '确认创建' }));

    expect(await within(dialog).findByRole('heading', { name: '先绑定安全手机号' })).toBeTruthy();
    await user.type(within(dialog).getByLabelText('当前账户密码'), 'owner-password');
    await user.click(within(dialog).getByRole('button', { name: '验证当前密码' }));
    await user.type(await within(dialog).findByLabelText('中国大陆手机号'), '13800138000');
    await user.click(within(dialog).getByRole('button', { name: '获取绑定验证码' }));
    await user.type(await within(dialog).findByLabelText('六位手机验证码'), '654321');
    await user.click(within(dialog).getByRole('button', { name: '验证并绑定手机号' }));

    expect(await within(dialog).findByText('手机号已绑定')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '使用新手机号重新登录' })).toBeTruthy();
    expect(enrollmentCalls).toEqual(['password.verify', 'mobile.challenge', 'mobile.manage']);
  });

  it('opens mobile enrollment without calling step-up when the session reports no bound phone', async () => {
    const user = userEvent.setup();
    let stepupCalls = 0;
    server.use(http.post('*/api/v1/identity/stepup/challenges', () => {
      stepupCalls += 1;
      return HttpResponse.json({ code: 'UNEXPECTED_STEPUP' }, { status: 500 });
    }));

    renderRoute('/applications', scope('enterprise', 'enterprise:hongtai', '鸿泰集团'), { phoneMasked: null });
    await screen.findByRole('table', { name: '商城列表' });
    await user.click(screen.getByRole('button', { name: '创建商城' }));

    const dialog = await screen.findByRole('dialog', { name: '创建商城' });
    expect(await within(dialog).findByRole('heading', { name: '先绑定安全手机号' })).toBeTruthy();
    expect(stepupCalls).toBe(0);
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
    renderRoute('/applications', scope('distributor', 'distributor:preview', '分销商'));
    await screen.findByRole('table', { name: '应用治理列表' });
    expect(screen.getByRole('button', { name: '创建商城' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '刷新数据' })).toBeNull();

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
    expect(headers?.get('x-scope-hint')).toBe('distributor:preview');
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
    renderRoute('/applications', scope('distributor', 'distributor:preview', '分销商'));
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
    renderRoute('/applications', scope('distributor', 'distributor:preview', '分销商'));
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
    renderRoute('/applications', scope('distributor', 'distributor:preview', '分销商'));
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
    renderRoute('/applications', scope('distributor', 'distributor:preview', '分销商'));
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
    renderRoute('/applications', scope('distributor', 'distributor:preview', '分销商'));
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
    renderRoute('/applications?campaign=keep', scope('platform', 'platform:preview', '主打团平台'));
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
  const management = activeScope.kind === 'platform' || activeScope.kind === 'enterprise';
  const platform = activeScope.kind === 'platform' ? activeScope : scope('platform', 'organization-platform-root', '主打团平台');
  const scopes = management
    ? activeScope.kind === 'platform'
      ? [activeScope, scope('enterprise', 'enterprise:hongtai', '鸿泰集团')]
      : [platform, activeScope]
    : [activeScope];
  return {
    session: {
      actor: 'actor:commerce',
      membership: 'membership:commerce',
      accessVersion: 11,
      permissions: ['experience.application.read', 'experience.application.manage', ...(management ? ['organization.layer.manage'] : [])],
      capabilities: ['experience.applications.read', 'experience.applications.create', 'experience.applications.update',
        'experience.applications.copy', ...(management ? ['provisioning.malls.create'] : [])],
      csrf: 'csrf-token-1234567890',
      target: 'console',
      scope: activeScope,
      scopes,
      assurance: { level: 2 },
      syncedAt: '2026-08-27T05:00:00.000Z',
    },
    profile: { display_name: '商城运营', employee_no: null },
    scope: activeScope,
    scopes,
  };
}

async function advanceMallCreateJourney(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
): Promise<void> {
  for (let step = 0; step < 6; step += 1) {
    await user.click(within(dialog).getByRole('button', { name: '下一步' }));
  }
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
