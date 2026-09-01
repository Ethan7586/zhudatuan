import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './MemberRoute';

const writes: Array<Readonly<{ body: unknown; headers: Headers }>> = [];
const resetWrites: Array<Readonly<{ body: unknown; headers: Headers }>> = [];
const server = setupServer(
  http.get('*/api/v1/members', () => HttpResponse.json(memberPage())),
  http.post('*/api/v1/identity/invitations', async ({ request }) => {
    writes.push({ body: await request.clone().json(), headers: request.headers });
    return HttpResponse.json(invitationReceipt(), { status: 201 });
  }),
  http.post('*/api/v1/identity/password/verify', () => HttpResponse.json({ verified: true, verifiedAt: '2026-08-29T00:00:00.000Z' })),
  http.put('*/api/v1/identity/members/:membershipid/registration', async ({ request }) => {
    resetWrites.push({ body: await request.clone().json(), headers: request.headers });
    return HttpResponse.json(resetReceipt());
  })
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
  it('creates a fixed zero-permission administrator invitation and forgets the code on close', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '成员管理' });
    expect(screen.getByRole('heading', { name: '会员与权限控制中心' })).toBeTruthy();
    expect(screen.getByText('角色模板')).toBeTruthy();
    expect(screen.getByText('数据范围')).toBeTruthy();
    expect(screen.getByText('明确禁止')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '生成管理员邀请码' }));
    const dialog = await screen.findByRole('dialog', { name: '生成管理员邀请码' });
    expect(within(dialog).queryByLabelText('角色')).toBeNull();
    expect(within(dialog).getByText(/固定创建待授权普通管理员/)).toBeTruthy();
    await user.type(within(dialog).getByLabelText('受邀管理员手机号'), '13800138000');
    await user.clear(within(dialog).getByLabelText('邀请名称'));
    await user.type(within(dialog).getByLabelText('邀请名称'), '集团运营邀请');
    await user.selectOptions(within(dialog).getByLabelText('有效期'), '3');
    await user.click(within(dialog).getByRole('button', { name: '生成邀请码' }));

    const receipt = await screen.findByRole('dialog', { name: '邀请码已生成' });
    expect(within(receipt).getByText('A'.repeat(32))).toBeTruthy();
    expect(writes[0]?.body).toMatchObject({ label: '集团运营邀请', destination: '13800138000', targetClient: 'operator', maxUses: 1 });
    expect(writes[0]?.headers.get('x-scope-hint')).toBe('tenant:one');
    expect(writes[0]?.headers.get('x-access-version')).toBe('7');
    expect(writes[0]?.headers.get('x-csrf-token')).toBe('csrf-token-for-invitation');

    await user.click(within(receipt).getByRole('button', { name: /^关闭$/ }));
    expect(screen.getByRole('dialog', { name: '邀请码已生成' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: '邀请码已生成' })).toBeTruthy();
    const backdrop = receipt.closest('.dialogbackdrop');
    if (!(backdrop instanceof HTMLElement)) throw new Error('INVITATION_DIALOG_BACKDROP_MISSING');
    await user.click(backdrop);
    expect(screen.getByRole('dialog', { name: '邀请码已生成' })).toBeTruthy();

    await user.click(within(receipt).getByRole('button', { name: '复制邀请码' }));
    expect(writeText).toHaveBeenCalledWith('A'.repeat(32));
    expect((await within(receipt).findByRole('status')).textContent).toContain('已复制到剪贴板');
    await user.click(within(receipt).getByRole('button', { name: '我已保存，关闭' }));
    await user.click(screen.getByRole('button', { name: '生成管理员邀请码' }));
    expect(await screen.findByRole('dialog', { name: '生成管理员邀请码' })).toBeTruthy();
    expect(screen.queryByText('A'.repeat(32))).toBeNull();
  });

  it('keeps the platform entry visible and creates the invitation for the selected tenant', async () => {
    const user = userEvent.setup();
    renderRoute(platformOwnerContext);
    await screen.findByRole('table', { name: '成员管理' });

    await user.click(screen.getByRole('button', { name: '生成管理员邀请码' }));
    const dialog = await screen.findByRole('dialog', { name: '生成管理员邀请码' });
    await user.selectOptions(within(dialog).getByLabelText('目标租户'), 'tenant-zhudatuan');
    await user.type(within(dialog).getByLabelText('受邀管理员手机号'), '13800138000');
    await user.click(within(dialog).getByRole('button', { name: '生成邀请码' }));

    await screen.findByRole('dialog', { name: '邀请码已生成' });
    expect(writes[0]?.body).toMatchObject({ tenantId: 'tenant-zhudatuan', destination: '13800138000', targetClient: 'operator' });
    expect(writes[0]?.headers.get('x-scope-hint')).toBe('platform:one');
  });

  it.each(missingEvidenceCases)('hides the write entry when %s evidence is missing', async (_name, sessionPatch) => {
    renderRoute({ ...ownerContext, session: { ...ownerContext.session, ...sessionPatch } });
    await screen.findByRole('table', { name: '成员管理' });

    expect(screen.queryByRole('button', { name: '生成管理员邀请码' })).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it('rejects a malformed success payload without exposing an invitation code', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/v1/identity/invitations', () => HttpResponse.json({ id: 'invite:broken', code: 'short' }, { status: 201 })));
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '成员管理' });
    await user.click(screen.getByRole('button', { name: '生成管理员邀请码' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('受邀管理员手机号'), '13800138000');
    await user.click(within(dialog).getByRole('button', { name: '生成邀请码' }));

    expect((await screen.findByRole('alert')).textContent).toContain('邀请码生成失败');
    expect(screen.queryByText('short')).toBeNull();
  });
});

describe('Owner member registration reset', () => {
  it('verifies the Owner password, resets without physical deletion and opens a fresh invitation flow', async () => {
    const user = userEvent.setup();
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '成员管理' });

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
    expect(await screen.findByRole('dialog', { name: '生成管理员邀请码' })).toBeTruthy();
  });

  it.each(resetMissingEvidenceCases)('hides reset actions when %s evidence is missing', async (_name, sessionPatch) => {
    renderRoute({ ...ownerContext, session: { ...ownerContext.session, ...sessionPatch } });
    await screen.findByRole('table', { name: '成员管理' });

    expect(screen.queryByRole('button', { name: '重置注册身份' })).toBeNull();
    expect(resetWrites).toHaveLength(0);
  });

  it('hides reset actions for a server-protected identity', async () => {
    server.use(http.get('*/api/v1/members', () => HttpResponse.json(memberPage({ reset_allowed: false, reset_block_reason: 'OWNER_PROTECTED' }))));
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '成员管理' });

    expect(screen.queryByRole('button', { name: '重置注册身份' })).toBeNull();
  });
});

function renderRoute(context: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <Component />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const tenantScope = { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one', name: '主打团租户' } as const;
const secondTenantScope = { kind: 'tenant', id: 'tenant-smart-wing', tenant: 'tenant-smart-wing', name: '主打团租户' } as const;
const zhudatuanTenantScope = { ...tenantScope, id: 'tenant-zhudatuan', tenant: 'tenant-zhudatuan', name: '主打团' } as const;
const platformScope = { kind: 'platform', id: 'platform:one', name: '福利商城平台' } as const;
const missingEvidenceCases: ReadonlyArray<readonly [string, Partial<ConsoleContext['session']>]> = [
  ['permission', { permissions: [] }],
  ['capability', { capabilities: [] }],
  ['csrf', { csrf: undefined }],
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

function resetReceipt() {
  return {
    principal_id: 'principal:employee',
    status: 'reset',
    login_identity_released: true,
    history_retained: true,
    version: '12',
  };
}

function invitationReceipt() {
  const now = new Date().toISOString();
  return {
    id: 'invite:one',
    code: 'A'.repeat(32),
    label: '集团运营邀请',
    target: 'console',
    max_uses: 2,
    use_count: 0,
    starts_at: now,
    expires_at: new Date(Date.now() + 259_200_000).toISOString(),
    status: 'active',
    created_at: now,
    version: '0',
  };
}
