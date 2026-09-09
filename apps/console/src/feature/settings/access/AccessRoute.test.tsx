import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DependencyProvider } from '../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { readActionRequest } from '../../../shared/security/ActionRequest';
import { Component } from './route/AccessRoute';

const server = setupServer(
  http.get('*/api/v1/access/center', () =>
    HttpResponse.json({
      items: [
        {
          id: 'membership:internal-value',
          display_name: '张三',
          employee_no: 'E1001',
          mobile_masked: '138****0000',
          client: 'console',
          status: 'active',
          access_version: 3,
          roles: [{ role: 'role:self', name: 'Self Service', description: '自助服务角色', status: 'active', kind: 'system', template: null, version: 1, allows: [], denies: [] }],
          scopes: [],
          overrides: [],
        },
      ],
      count: 1,
      roles: [],
      templates: [],
      separationRules: [],
    })
  ),
  http.get('*/api/v1/access/ownership', () => HttpResponse.json(ownershipState())),
  http.get('*/api/v1/organizations/layers', () =>
    HttpResponse.json({
      items: [
        { id: 'mall:one', kind: 'mall', parent_id: 'enterprise:two', parent_name: '华东企业', name: '测试商城', timezone: 'Asia/Shanghai', status: 'active', version: 4 },
        { id: 'enterprise:two', kind: 'enterprise', parent_id: null, parent_name: null, name: '华东企业', timezone: 'Asia/Shanghai', status: 'active', version: 2 },
      ],
      count: 2,
    })
  ),
  http.post('*/api/v1/access/ownership/transfers/preview', () =>
    HttpResponse.json({
      sourceMembership: 'membership:owner',
      targetMembership: 'membership:next',
      ownershipVersion: 4,
      targetAccessVersion: 9,
      formerOwnerRoleVersion: 3,
      affectedPeople: 2,
      affectedScopes: 1,
      warnings: ['接受后双方权限版本立即递增'],
      state: 'draft',
      formerOwnerMode: 'retain_admin',
      formerOwnerRole: 'role:operator',
      coolingUntil: '2026-09-05T00:00:00Z',
      expiresAt: '2026-09-11T00:00:00Z',
    })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  window.localStorage.clear();
});
afterAll(() => server.close());

describe('access center account presentation', () => {
  it('shows the account name and human account label without exposing the membership id', async () => {
    renderRoute(vi.fn());

    expect(await screen.findByText('张三')).toBeTruthy();
    expect(screen.getByText('员工号 E1001')).toBeTruthy();
    expect(screen.getByText('自助服务')).toBeTruthy();
    expect(screen.queryByText('Self Service')).toBeNull();
    expect(screen.queryByText('membership:internal-value')).toBeNull();
  });

  it('turns STEPUP_REQUIRED into the shared Chinese verification flow', async () => {
    const request = vi.fn();
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json({ code: 'STEPUP_REQUIRED', message: 'STEPUP_REQUIRED', requestId: 'request:access', retryable: false }, { status: 403 })));
    renderRoute(request);

    const action = await screen.findByRole('button', { name: '立即完成二次验证' });
    expect(screen.getByText(/管理员账号、角色和项目范围属于敏感信息/)).toBeTruthy();
    expect(screen.queryByText(/request:access/)).toBeNull();
    fireEvent.click(action);
    expect(request).toHaveBeenCalledOnce();
  });

  it('explains the safe change journey in business language and keeps ownership actions in their task', async () => {
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json(ownerPage())));
    renderRoute(vi.fn(), true, 3);

    expect(await screen.findByText('选择管理任务')).toBeTruthy();
    expect(screen.getByText('查看变更影响')).toBeTruthy();
    expect(screen.getByText('验证后生效')).toBeTruthy();
    expect(screen.queryByText(/乐观锁|幂等键|权威回读/)).toBeNull();
    expect(screen.queryByRole('button', { name: '发起所有权转移' })).toBeNull();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /所有权转移/ }));
    expect(await screen.findByRole('button', { name: '发起所有权转移' })).toBeTruthy();
  });

  it('requires step-up before preparing an owner transfer', async () => {
    const request = vi.fn();
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json(ownerPage())));
    renderRoute(request, true, 2);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /所有权转移/ }));
    await user.click(await screen.findByRole('button', { name: '发起所有权转移' }));
    await user.type(screen.getByLabelText('转移原因'), '负责人岗位调整');
    await user.click(screen.getByRole('button', { name: '立即完成二次验证' }));
    expect(request).toHaveBeenCalledOnce();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '确认发起申请' }).disabled).toBe(true);
  });

  it('binds the maker-checker request to owner operation, current version and maker', async () => {
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json(ownerPage())));
    renderRoute(vi.fn(), true, 3);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /所有权转移/ }));
    await user.click(await screen.findByRole('button', { name: '发起所有权转移' }));
    await user.type(screen.getByLabelText('转移原因'), '负责人岗位调整');
    await user.click(screen.getByRole('button', { name: '生成复核请求码' }));
    const encoded = await screen.findByLabelText('复核请求码');
    expect(screen.getByRole('region', { name: '变更影响预演' })).toBeTruthy();
    expect(readActionRequest((encoded as HTMLTextAreaElement).value)).toMatchObject({ operation: 'access.ownership.transfers.create', resource: 'mall:one', expectedVersion: 4, makerMembership: 'membership:owner' });
  });

  it('preserves the draft and shows authoritative differences instead of overwriting an owner conflict', async () => {
    let ownershipReads = 0;
    server.use(
      http.get('*/api/v1/access/center', () => HttpResponse.json(ownerPage())),
      http.get('*/api/v1/access/ownership', () => HttpResponse.json({ ...ownershipState(), version: ownershipReads++ === 0 ? 4 : 5 })),
      http.post('*/api/v1/access/ownership/transfers', () => HttpResponse.json({ code: 'VERSION_CONFLICT', message: 'VERSION_CONFLICT', requestId: 'request:conflict', retryable: true }, { status: 409 }))
    );
    renderRoute(vi.fn(), true, 3);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /所有权转移/ }));
    await user.click(await screen.findByRole('button', { name: '发起所有权转移' }));
    await user.type(screen.getByLabelText('转移原因'), '负责人岗位调整');
    await user.click(screen.getByRole('button', { name: '生成复核请求码' }));
    await screen.findByRole('region', { name: '变更影响预演' });
    await user.type(screen.getByLabelText('一次性复核凭证'), 'p'.repeat(43));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '确认发起申请' }));

    const conflict = await screen.findByRole('alert', { name: '并发修改冲突' });
    expect(conflict.textContent).toContain('所有权版本：第 4 版 → 第 5 版');
    expect(screen.getByLabelText<HTMLTextAreaElement>('转移原因').value).toBe('负责人岗位调整');
    await user.click(screen.getByRole('button', { name: '应用最新基线并重新复核' }));
    expect(screen.getByLabelText<HTMLInputElement>('一次性复核凭证').value).toBe('');
    expect(screen.getByText('请确认申请内容；新所有者接受前不会切换权限。')).toBeTruthy();
  });

  it('restores a three-step role draft and finds refund permissions by Chinese business wording', async () => {
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json(rolePage())));
    const first = renderRoute(vi.fn(), true, 3);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /岗位角色/ }));
    await user.click(screen.getByRole('button', { name: '新建角色' }));
    await user.click(screen.getByRole('button', { name: /自定义/ }));
    await user.type(screen.getByLabelText('角色名称'), '退款客服');
    await user.type(screen.getByLabelText('角色说明'), '负责退款申请与客户沟通');
    await user.click(screen.getByRole('button', { name: '下一步' }));
    await user.type(screen.getByLabelText('搜索业务权限'), '退款');
    expect(screen.getByText('支付 · 退款')).toBeTruthy();
    first.unmount();

    renderRoute(vi.fn(), true, 3);
    await user.click(await screen.findByRole('button', { name: /岗位角色/ }));
    await user.click(screen.getByRole('button', { name: '新建角色' }));
    expect(screen.getByText(/当前管理范围/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /选择岗位模板/ }));
    expect(screen.getByLabelText<HTMLInputElement>('角色名称').value).toBe('退款客服');
    await user.click(screen.getByRole('button', { name: /复核并保存/ }));
    expect(screen.getByText(/位受影响成员/)).toBeTruthy();
    expect(screen.getByText(/未发现职责分离冲突/)).toBeTruthy();
  });

  it('selects delegated projects by business name and filters member overrides by Chinese synonyms', async () => {
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json(ownerPage())));
    renderRoute(vi.fn(), true, 3);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /项目范围/ }));
    await user.click(screen.getAllByRole('button', { name: '项目授权' })[0]!);
    expect(await screen.findByRole('option', { name: '测试商城' })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('项目类型'), 'enterprise');
    expect(screen.getByRole('option', { name: '华东企业' })).toBeTruthy();
    expect(screen.queryByText('enterprise:two')).toBeNull();
    await user.click(screen.getByRole('button', { name: '关闭' }));

    await user.click(screen.getByRole('button', { name: /成员与权限/ }));
    await user.click(screen.getByRole('button', { name: '编辑权限' }));
    await user.type(screen.getByLabelText('搜索业务权限'), '返款');
    expect(screen.getByRole('option', { name: '支付 · 退款' })).toBeTruthy();
  });
});

function renderRoute(request: () => void, privileged = false, level = 2) {
  const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
  const context: ConsoleContext = {
    session: {
      actor: 'principal:one',
      membership: 'membership:owner',
      accessVersion: 7,
      permissions: privileged
        ? ['access.center.read', 'access.ownership.read', 'access.ownership.transfer', 'access.role.manage', 'access.scope.manage', 'access.override.manage', 'organization.layer.read', 'payment.refund']
        : ['access.center.read'],
      capabilities: privileged
        ? ['access.center.read', 'access.ownership.read', 'access.ownership.transfers.preview', 'access.ownership.transfers.create', 'access.roles.manage', 'access.scopes.manage', 'access.overrides.manage', 'organization.layers.read']
        : ['access.center.read'],
      target: 'console',
      scope,
      scopes: [scope, { kind: 'enterprise', id: 'enterprise:two', name: '华东企业' }],
      assurance: { level },
      security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
      syncedAt: '2026-09-03T00:00:00Z',
      csrf: 'csrf',
    },
    profile: { display_name: '管理员', employee_no: 'A001' },
    scope,
    scopes: [scope, { kind: 'enterprise', id: 'enterprise:two', name: '华东企业' }],
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <StepupProvider controller={{ request }}>
            <DependencyProvider value={createConsoleDependencies()}>
              <Component />
            </DependencyProvider>
          </StepupProvider>
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function ownerPage() {
  return {
    items: [
      {
        id: 'membership:owner',
        display_name: '当前负责人',
        employee_no: 'A001',
        mobile_masked: '138****0000',
        client: 'console',
        status: 'active',
        access_version: 11,
        roles: [{ role: 'role:owner', name: 'Owner', description: '唯一所有者', status: 'active', kind: 'owner', template: null, version: 5, allows: [], denies: [] }],
        scopes: [],
        overrides: [],
      },
      { id: 'membership:next', display_name: '新负责人', employee_no: 'A002', mobile_masked: '139****0000', client: 'console', status: 'active', access_version: 9, roles: [], scopes: [], overrides: [] },
    ],
    count: 2,
    roles: [],
    templates: [],
    separationRules: [],
  };
}

function rolePage() {
  return {
    ...ownerPage(),
    roles: [],
    templates: [
      { code: 'malloperator', name: '商城运营', description: '适合商城日常经营', allows: ['access.center.read'], denies: [], version: 1 },
      { code: 'custom', name: '自定义', description: '从空权限开始逐项配置', allows: [], denies: [], version: 1 },
    ],
    separationRules: [{ left: 'finance.settlement.decide', right: 'finance.withdrawal.decide', reason: '结算审核与提现审核必须职责分离' }],
  };
}

function ownershipState() {
  return {
    state: 'active',
    version: 4,
    mobileReady: true,
    owner: { membership: 'membership:owner', member: 'member:owner', principal: 'principal:owner', displayName: '当前负责人' },
    candidates: [{ membership: 'membership:next', member: 'member:next', principal: 'principal:next', displayName: '新负责人', roles: [], accessVersion: 9, mobileReady: true }],
    formerOwnerRoles: [{ id: 'role:operator', name: '运营管理员', version: 3 }],
    pending: null,
  };
}
