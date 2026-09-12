import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component as AccessComponent } from '../access/AccessRoute';
import { MemberInvitationDialog } from './MemberInvitationDialog';
import { Component } from './MemberRoute';

const writes: Array<Readonly<{ body: unknown; headers: Headers }>> = [];
const resetWrites: Array<Readonly<{ body: unknown; headers: Headers }>> = [];
const server = setupServer(
  http.get('*/api/v1/members', () => HttpResponse.json(memberPage())),
  http.post('*/api/v1/identity/invitations', async ({ request }) => {
    const body = await request.clone().json();
    writes.push({ body, headers: request.headers });
    const governanceLevel = (body as Readonly<{ governanceLevel?: unknown }>).governanceLevel === 'senior_administrator'
      ? 'senior_administrator' : 'administrator';
    return HttpResponse.json(invitationReceipt(governanceLevel), { status: 201 });
  }),
  http.post('*/api/v1/identity/password/verify', () => HttpResponse.json({ verified: true, verifiedAt: '2026-08-29T00:00:00.000Z' })),
  http.put('*/api/v1/identity/members/:membershipid/registration', async ({ request }) => {
    resetWrites.push({ body: await request.clone().json(), headers: request.headers });
    return HttpResponse.json(resetReceipt());
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  writes.length = 0;
  resetWrites.length = 0;
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('member administrator invitation', () => {
  it('shows the senior administrator option when session governance projects the authoritative Owner', async () => {
    const nodeOwnerContext: ConsoleContext = {
      ...ownerContext,
      session: {
        ...ownerContext.session,
        governance: { level: 'owner', exactOwner: false, organization: 'mall:one' },
      },
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemberInvitationDialog
          context={nodeOwnerContext}
          open
          onClose={() => undefined}
        />
      </QueryClientProvider>,
    );

    const dialog = await screen.findByRole('dialog', { name: '邀请管理员' });
    expect(within(dialog).getByRole('radio', { name: /^高级管理员/ })).toBeTruthy();
  });

  it('creates a fixed zero-permission administrator invitation and forgets the code on close', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn((_value: string) => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '管理员目录' });

    await user.click(screen.getByRole('button', { name: '邀请管理员' }));
    const dialog = await screen.findByRole('dialog', { name: '邀请管理员' });
    const level = within(dialog).getByRole('group', { name: '管理员级别' });
    expect((within(level).getByRole('radio', { name: /^普通管理员/ }) as HTMLInputElement).checked).toBe(true);
    expect((within(level).getByRole('radio', { name: /^高级管理员/ }) as HTMLInputElement).checked).toBe(false);
    await user.type(within(dialog).getByLabelText('受邀管理员手机号'), '13800138000');
    await user.clear(within(dialog).getByLabelText('邀请名称'));
    await user.type(within(dialog).getByLabelText('邀请名称'), '集团运营邀请');
    await user.selectOptions(within(dialog).getByLabelText('有效期'), '3');
    await user.click(within(dialog).getByRole('button', { name: '生成管理员邀请' }));

    const receipt = await screen.findByRole('dialog', { name: '管理员邀请已生成' });
    expect(within(receipt).getByText('A'.repeat(10))).toBeTruthy();
    expect(writes[0]?.body).toMatchObject({ label: '集团运营邀请', destination: '13800138000', targetClient: 'operator', governanceLevel: 'administrator', maxUses: 1 });
    expect(writes[0]?.headers.get('x-scope-hint')).toBe('tenant:one');
    expect(writes[0]?.headers.get('x-access-version')).toBe('7');
    expect(writes[0]?.headers.get('x-csrf-token')).toBe('csrf-token-for-invitation');

    await user.click(within(receipt).getByRole('button', { name: '复制邀请码' }));
    expect(writeText).toHaveBeenCalledWith('A'.repeat(10));
    expect(within(receipt).getAllByText('已复制').length).toBeGreaterThan(0);
    expect(within(receipt).getByRole('button', { name: '管理员邀请码已复制' })).toBeTruthy();
    expect(within(receipt).getByRole('button', { name: '邀请码已复制' })).toBeTruthy();
    expect((await within(receipt).findByRole('status')).textContent).toContain('邀请码已复制');
    await user.click(within(receipt).getByRole('button', { name: '复制邀请链接' }));
    expect(String(writeText.mock.calls[1]?.[0])).toContain('invite=AAAAAAAAAA');
    await user.click(within(receipt).getByRole('button', { name: '完成' }));
    await user.click(screen.getByRole('button', { name: '邀请管理员' }));
    expect(await screen.findByRole('dialog', { name: '邀请管理员' })).toBeTruthy();
    expect(screen.queryByText('A'.repeat(10))).toBeNull();
  });

  it('lets an Owner select a senior administrator and shows the real level in the receipt', async () => {
    const user = userEvent.setup();
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '管理员目录' });
    await user.click(screen.getByRole('button', { name: '邀请管理员' }));
    const dialog = await screen.findByRole('dialog', { name: '邀请管理员' });

    await user.click(within(dialog).getByRole('radio', { name: /^高级管理员/ }));
    await user.type(within(dialog).getByLabelText('受邀管理员手机号'), '13800138000');
    await user.click(within(dialog).getByRole('button', { name: '生成管理员邀请' }));

    const receipt = await screen.findByRole('dialog', { name: '管理员邀请已生成' });
    expect(writes[0]?.body).toMatchObject({ governanceLevel: 'senior_administrator' });
    expect(within(receipt).getByText('高级管理员')).toBeTruthy();
  });

  it('does not show the peer-level option to a senior administrator', async () => {
    const user = userEvent.setup();
    const seniorContext: ConsoleContext = {
      ...ownerContext,
      session: {
        ...ownerContext.session,
        governance: { level: 'senior_administrator', exactOwner: false, organization: 'tenant:one' },
      },
    };
    renderRoute(seniorContext);
    await screen.findByRole('table', { name: '管理员目录' });
    await user.click(screen.getByRole('button', { name: '邀请管理员' }));
    const dialog = await screen.findByRole('dialog', { name: '邀请管理员' });

    expect(within(dialog).getByRole('group', { name: '管理员级别' })).toBeTruthy();
    expect(within(dialog).queryByRole('radio', { name: /^高级管理员/ })).toBeNull();
    expect(within(dialog).getByText(/完成注册后进入管理后台/)).toBeTruthy();
    await user.type(within(dialog).getByLabelText('受邀管理员手机号'), '13800138000');
    await user.click(within(dialog).getByRole('button', { name: '生成管理员邀请' }));

    await screen.findByRole('dialog', { name: '管理员邀请已生成' });
    expect(writes[0]?.body).toMatchObject({ governanceLevel: 'administrator' });
  });

  it('keeps the platform entry visible and creates the invitation for the selected tenant', async () => {
    const user = userEvent.setup();
    renderRoute(platformOwnerContext);
    await screen.findByRole('table', { name: '管理员目录' });

    await user.click(screen.getByRole('button', { name: '邀请管理员' }));
    const dialog = await screen.findByRole('dialog', { name: '邀请管理员' });
    await user.selectOptions(within(dialog).getByLabelText('授权范围'), 'tenant-zhudatuan');
    await user.type(within(dialog).getByLabelText('受邀管理员手机号'), '13800138000');
    await user.click(within(dialog).getByRole('button', { name: '生成管理员邀请' }));

    await screen.findByRole('dialog', { name: '管理员邀请已生成' });
    expect(writes[0]?.body).toMatchObject({ tenantId: 'tenant-zhudatuan', destination: '13800138000', targetClient: 'operator' });
    expect(writes[0]?.headers.get('x-scope-hint')).toBe('platform:one');
  });

  it('keeps the operator member endpoint authoritative when access data contains role-bearing identities', async () => {
    server.use(http.get('*/api/v1/members', () => HttpResponse.json({ items: [], count: 0 })));
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json({
      items: [
        accessMembership('membership:owner', 'Ethan', 'Owner'),
        accessMembership('membership:senior', '高级管理员', '高级管理员'),
        accessMembership('membership:l6-consumer', 'L6消费者7586', '商城会员', 'role-zhudatuan-storefront-member:mall-hbbtzn'),
        accessMembership('membership:duplicate-ethan', 'Ethan', '商城会员', 'role-zhudatuan-storefront-member:mall-hbbtzn'),
      ],
      count: 4,
      roles: [],
    })));
    renderRoute({
      ...ownerContext,
      session: {
        ...ownerContext.session,
        permissions: [...ownerContext.session.permissions, 'access.center.read'],
        capabilities: [...ownerContext.session.capabilities, 'access.center.read'],
      },
    });

    expect(await screen.findByText('暂无管理员')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '管理员目录' })).toBeNull();
    expect(screen.queryByText('Ethan')).toBeNull();
    expect(screen.queryByText('高级管理员')).toBeNull();
    expect(screen.queryByText('L6消费者7586')).toBeNull();
    expect(screen.getByText('当前页 0 位 · 共 0 位管理员')).toBeTruthy();
  });

  it.each(legacyInvitationEvidenceCases)('keeps the write entry when stale %s evidence is missing', async (_name, sessionPatch) => {
    renderRoute({ ...ownerContext, session: { ...ownerContext.session, ...sessionPatch } });
    await screen.findByRole('table', { name: '管理员目录' });

    expect(screen.getByRole('button', { name: '邀请管理员' })).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it.each(missingInvitationAuthorityCases)('hides the write entry when %s evidence is missing', async (_name, sessionPatch) => {
    renderRoute({ ...ownerContext, session: { ...ownerContext.session, ...sessionPatch } });
    await screen.findByRole('table', { name: '管理员目录' });

    expect(screen.queryByRole('button', { name: '邀请管理员' })).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it('rejects a malformed success payload without exposing an invitation code', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/v1/identity/invitations', () => HttpResponse.json({ id: 'invite:broken', code: 'short' }, { status: 201 })));
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '管理员目录' });
    await user.click(screen.getByRole('button', { name: '邀请管理员' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('受邀管理员手机号'), '13800138000');
    await user.click(within(dialog).getByRole('button', { name: '生成管理员邀请' }));

    expect((await screen.findByRole('alert')).textContent).toContain('邀请生成失败');
    expect(screen.queryByText('short')).toBeNull();
  });

  it.each([
    ['ADMINISTRATOR_ALREADY_EXISTS', '该手机号已经是当前商城的管理员，无需重复邀请。'],
    ['ADMINISTRATOR_INVITATION_ALREADY_ACTIVE', '该手机号已有一张未使用的管理员邀请，请前往邀请记录查看或撤销后重发。'],
  ])('explains the %s invitation conflict', async (code, message) => {
    const user = userEvent.setup();
    server.use(http.post('*/api/v1/identity/invitations', () => HttpResponse.json({ code, message: code, requestId: 'request:conflict' }, { status: 409 })));
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '管理员目录' });
    await user.click(screen.getByRole('button', { name: '邀请管理员' }));
    const dialog = await screen.findByRole('dialog', { name: '邀请管理员' });
    await user.type(within(dialog).getByLabelText('受邀管理员手机号'), '13800138000');
    await user.click(within(dialog).getByRole('button', { name: '生成管理员邀请' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain(message);
    expect(screen.queryByRole('dialog', { name: '管理员邀请已生成' })).toBeNull();
  });
});

describe('Owner member registration reset', () => {
  it('verifies the Owner password, resets without physical deletion and opens a fresh invitation flow', async () => {
    const user = userEvent.setup();
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '管理员目录' });

    await user.click(screen.getByRole('row', { name: '查看管理员 测试员工' }));
    await user.click(screen.getByRole('button', { name: '重置注册身份' }));
    const dialog = await screen.findByRole('dialog', { name: '重置注册身份' });
    expect(within(dialog).getByText('这不是物理删除会员资料')).toBeTruthy();
    expect(within(dialog).getByText(/订单、卡券、财务记录与安全审计会继续保留/)).toBeTruthy();
    await user.type(within(dialog).getByLabelText('操作原因'), '测试账号重新注册');
    await user.click(within(dialog).getByRole('checkbox'));
    await user.type(within(dialog).getByLabelText('输入“重置”确认'), '重置');
    await user.type(within(dialog).getByLabelText('当前 Owner 密码'), 'Owner!Password1');
    await user.click(within(dialog).getByRole('button', { name: '验证密码并重置' }));

    const receipt = await screen.findByRole('dialog', { name: '注册身份已重置' });
    expect(within(receipt).getByText('原登录手机号已释放')).toBeTruthy();
    expect(resetWrites).toHaveLength(1);
    expect(resetWrites[0]?.body).toEqual({ reason: '测试账号重新注册' });
    expect(resetWrites[0]?.headers.get('if-match')).toBe('"11"');
    expect(JSON.stringify(resetWrites[0]?.body)).not.toContain('Owner!Password1');

    await user.click(within(receipt).getByRole('button', { name: '生成新的管理员邀请码' }));
    expect(await screen.findByRole('dialog', { name: '邀请管理员' })).toBeTruthy();
  });

  it.each(resetMissingEvidenceCases)('hides reset actions when %s evidence is missing', async (_name, sessionPatch) => {
    const user = userEvent.setup();
    renderRoute({ ...ownerContext, session: { ...ownerContext.session, ...sessionPatch } });
    await screen.findByRole('table', { name: '管理员目录' });
    await user.click(screen.getByRole('row', { name: '查看管理员 测试员工' }));

    expect(screen.queryByRole('button', { name: '重置注册身份' })).toBeNull();
    expect(resetWrites).toHaveLength(0);
  });

  it('hides reset actions for a server-protected identity', async () => {
    const user = userEvent.setup();
    server.use(http.get('*/api/v1/members', () => HttpResponse.json(memberPage({ reset_allowed: false, reset_block_reason: 'OWNER_PROTECTED' }))));
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '管理员目录' });
    await user.click(screen.getByRole('row', { name: '查看管理员 测试员工' }));

    expect(screen.queryByRole('button', { name: '重置注册身份' })).toBeNull();
  });
});

function renderRoute(context: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/scopes/tenant/tenant%3Aone/settings/members']}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <Routes>
            <Route path="/scopes/:scopeKind/:scopeId/settings/members" element={<Component />} />
            <Route path="/scopes/:scopeKind/:scopeId/settings/access" element={<AccessComponent />} />
          </Routes>
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const tenantScope = { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one', name: '主打团租户' } as const;
const secondTenantScope = { kind: 'tenant', id: 'tenant-smart-wing', tenant: 'tenant-smart-wing', name: '智慧翼租户' } as const;
const zhudatuanTenantScope = { ...tenantScope, id: 'tenant-zhudatuan', tenant: 'tenant-zhudatuan', name: '主打团' } as const;
const platformScope = { kind: 'platform', id: 'platform:one', name: '福利商城平台' } as const;
const legacyInvitationEvidenceCases: ReadonlyArray<readonly [string, Partial<ConsoleContext['session']>]> = [
  ['permission', { permissions: [] }],
  ['capability', { capabilities: [] }],
];
const missingInvitationAuthorityCases: ReadonlyArray<readonly [string, Partial<ConsoleContext['session']>]> = [
  ['csrf', { csrf: undefined }],
  ['governance', { governance: { level: 'administrator', exactOwner: false, organization: 'tenant:one' } }],
];
const resetMissingEvidenceCases: ReadonlyArray<readonly [string, Partial<ConsoleContext['session']>]> = [
  ['permission', { permissions: ['member.read', 'identity.invitation.manage'] }],
  ['capability', { capabilities: ['member.members.read', 'identity.invitations.create', 'identity.password.verify'] }],
  ['csrf', { csrf: undefined }],
];
const ownerContext: ConsoleContext = {
  session: {
    actor: 'actor:owner',
    membership: 'membership:owner',
    accessVersion: 7,
    permissions: ['member.read', 'identity.assurance.manage', 'identity.invitation.manage', 'identity.registration.reset'],
    capabilities: ['member.members.read', 'identity.password.verify', 'identity.invitations.create', 'identity.members.reset'],
    governance: { level: 'owner', exactOwner: true, organization: 'tenant:one' },
    assurance: { level: 2 },
    csrf: 'csrf-token-for-invitation',
    target: 'console',
    scope: tenantScope,
    scopes: [tenantScope],
    syncedAt: '2026-08-29T00:00:00.000Z',
  },
  profile: { display_name: 'Ethan', employee_no: null },
  scope: tenantScope,
  scopes: [tenantScope],
};
const platformOwnerContext: ConsoleContext = {
  ...ownerContext,
  session: { ...ownerContext.session, scope: platformScope, scopes: [platformScope, zhudatuanTenantScope, secondTenantScope] },
  scope: platformScope,
  scopes: [platformScope, zhudatuanTenantScope, secondTenantScope],
};

function memberPage(patch: Readonly<Record<string, unknown>> = {}) {
  return {
    items: [
      {
        id: 'member:employee',
        display_name: '测试员工',
        status: 'active',
        membership_id: 'membership:employee',
        employee_no: null,
        membership_status: 'active',
        access_version: '7',
        joined_at: '2026-08-29T00:00:00.000Z',
        principal_id: 'principal:employee',
        principal_version: '11',
        client: 'operator',
        login_identity_bound: true,
        reset_allowed: true,
        reset_block_reason: null,
        ...patch,
      },
    ],
    count: 1,
  };
}

function accessMembership(id: string, displayName: string, roleName?: string, roleId?: string) {
  return {
    id,
    status: 'active',
    access_version: '7',
    member_id: id.replace('membership:', 'member:'),
    display_name: displayName,
    employee_no: null,
    roles: roleName === undefined ? [] : [{
      role: roleId ?? `role:${roleName.toLocaleLowerCase('zh-CN')}`,
      name: roleName,
      scope: tenantScope,
      scope_source: 'direct',
      effective_at: '2026-08-29T00:00:00.000Z',
      expires: null,
    }],
    scopes: [],
    denies: [],
    effective_permissions: [],
  };
}

function resetReceipt() {
  return {
    principal_id: 'principal:employee',
    status: 'reset',
    login_identity_released: true,
    history_retained: true,
    version: '12',
  };
}

function invitationReceipt(governanceLevel: 'administrator' | 'senior_administrator' = 'administrator') {
  const now = new Date().toISOString();
  return {
    id: 'invite:one',
    code: 'A'.repeat(10),
    label: '集团运营邀请',
    target: 'console',
    governanceLevel,
    max_uses: 2,
    use_count: 0,
    starts_at: now,
    expires_at: new Date(Date.now() + 259_200_000).toISOString(),
    status: 'active',
    created_at: now,
    version: '0',
  };
}
