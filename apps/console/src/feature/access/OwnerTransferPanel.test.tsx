import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { OwnerTransferPanel } from './OwnerTransferPanel';

const coolingUntil = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
let ownershipReads = 0;
const server = setupServer(http.get('*/api/v1/access/ownership', ({ request }) => {
  ownershipReads += 1;
  expect(request.headers.get('x-scope-hint')).toBe('tenant-zhudatuan');
  expect(request.headers.get('x-access-version')).toBe('7');
  return HttpResponse.json({
    state: 'active', version: 4, mobileReady: true,
    owner: { membership: 'membership:owner', member: 'member:owner', principal: 'principal:owner', displayName: '当前 Owner' },
    candidates: [], formerOwnerRoles: [],
    pending: {
      id: 'owner-transfer:1', state: 'pending_acceptance', sourceMembership: 'membership:owner',
      targetMembership: 'membership:successor', targetMember: 'member:successor', targetPrincipal: 'principal:successor',
      targetDisplayName: '接任管理员', formerOwnerMode: 'retain_admin', formerOwnerRole: 'role-platform-admin-v2',
      coolingUntil, expiresAt, version: 1,
    },
  });
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { cleanup(); ownershipReads = 0; server.resetHandlers(); });
afterAll(() => server.close());

describe('Owner transfer panel', () => {
  it('shows the authoritative 24-hour cooling period and keeps successor acceptance disabled', async () => {
    renderPanel(targetContext);
    expect(await screen.findByText('等待接任人确认')).toBeTruthy();
    expect(screen.getByText('24 小时冷静期内')).toBeTruthy();
    const accept = screen.getByRole('button', { name: '本人确认接任 Owner' }) as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
    expect(screen.getByText(/7 天有效期|申请到期/)).toBeTruthy();
  });

  it('lets the pending successor accept from tenant/self scopes without granting platform scope', async () => {
    const user = userEvent.setup();
    const readyAt = new Date(Date.now() - 60_000).toISOString();
    server.use(http.get('*/api/v1/access/ownership', ({ request }) => {
      ownershipReads += 1;
      expect(request.headers.get('x-scope-hint')).toBe('tenant-zhudatuan');
      return HttpResponse.json({
        state: 'active', version: 4, mobileReady: true,
        owner: { membership: 'membership:owner', member: 'member:owner', principal: 'principal:owner', displayName: '当前 Owner' },
        candidates: [], formerOwnerRoles: [],
        pending: {
          id: 'owner-transfer:1', state: 'pending_acceptance', sourceMembership: 'membership:owner',
          targetMembership: 'membership:successor', targetMember: 'member:successor', targetPrincipal: 'principal:successor',
          targetDisplayName: '接任管理员', formerOwnerMode: 'retain_admin', formerOwnerRole: 'role-platform-admin-v2',
          coolingUntil: readyAt, expiresAt, version: 1,
        },
      });
    }));
    expect(targetContext.scopes.some(({ kind }) => kind === 'platform')).toBe(false);
    renderPanel(targetContext);
    const accept = await screen.findByRole('button', { name: '本人确认接任 Owner' }) as HTMLButtonElement;
    expect(ownershipReads).toBe(1);
    expect(accept.disabled).toBe(false);
    expect(screen.queryByRole('button', { name: '发起 Owner 转让' })).toBeNull();
    expect(screen.queryByRole('button', { name: '取消待确认转让' })).toBeNull();
    await user.click(accept);
    expect(await screen.findByRole('heading', { name: '确认接任 Owner' })).toBeTruthy();
  });

  it('allows transfer with remove_admin when no former Owner admin role is available', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/v1/access/ownership', () => HttpResponse.json({
        state: 'active', version: 4, mobileReady: true,
        owner: { membership: 'membership:owner', member: 'member:owner', principal: 'principal:owner', displayName: '当前 Owner' },
        candidates: [{ membership: 'membership:successor', member: 'member:successor', principal: 'principal:successor',
          displayName: '接任管理员', roles: ['普通管理员'], accessVersion: 7, mobileReady: true }],
        formerOwnerRoles: [], pending: null,
      })),
      http.post('*/api/v1/identity/stepup/challenges', () => HttpResponse.json({
        id: 'challenge:owner', purpose: 'stepup', expires_at: new Date(Date.now() + 300_000).toISOString(),
      }, { status: 202 })),
      http.post('*/api/v1/identity/stepup/verifications', () => HttpResponse.json({ id: 'session:owner', assurance_level: 3 })),
      http.get('*/api/v1/identity/session', () => HttpResponse.json({ ...ownerContext.session, assurance: { level: 3 } })),
      http.post('*/api/v1/access/ownership/transfers/preview', async ({ request }) => {
        expect(await request.json()).toEqual({
          targetMembership: 'membership:successor', formerOwnerMode: 'remove_admin',
        });
        return HttpResponse.json({
          proof: 'signed-owner-action-proof', proofExpiresAt: new Date(Date.now() + 300_000).toISOString(), ownershipVersion: 4,
          targetAccessVersion: 7, sourceMembership: 'membership:owner', targetMembership: 'membership:successor',
          formerOwnerMode: 'remove_admin', formerOwnerRole: null, formerOwnerRoleVersion: null,
        });
      }),
    );
    renderPanel(ownerContext);
    const trigger = await screen.findByRole('button', { name: '发起 Owner 转让' }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(false);
    await user.click(trigger);
    const removeAdmin = await screen.findByRole('radio', { name: '移除后台管理员身份' }) as HTMLInputElement;
    expect(removeAdmin.checked).toBe(true);
    expect(screen.getByText('没有可分配的原 Owner 管理员角色')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '发送本人短信验证码' }));
    await user.type(await screen.findByLabelText('6 位短信验证码'), '123456');
    await user.click(screen.getByRole('button', { name: '验证并生成权威预览' }));
    const previewRole = await screen.findByText('原 Owner 后续角色');
    expect(previewRole.parentElement?.textContent).toBe('原 Owner 后续角色无');
  }, 15_000);

  it('discards the action proof and returns to verification when execute detects a version conflict', async () => {
    const user = userEvent.setup();
    const authority = {
      state: 'active', version: 4, mobileReady: true,
      owner: { membership: 'membership:owner', member: 'member:owner', principal: 'principal:owner', displayName: '当前 Owner' },
      candidates: [{ membership: 'membership:successor', member: 'member:successor', principal: 'principal:successor',
        displayName: '接任管理员', roles: ['普通管理员'], accessVersion: 7, mobileReady: true }],
      formerOwnerRoles: [{ id: 'role-platform-admin-v2', name: '平台管理员', version: 3 }], pending: null,
    } as const;
    server.use(
      http.get('*/api/v1/access/ownership', () => HttpResponse.json(authority)),
      http.post('*/api/v1/identity/stepup/challenges', async ({ request }) => {
        expect(await request.json()).toEqual({});
        return HttpResponse.json({ id: 'challenge:owner', purpose: 'stepup', expires_at: new Date(Date.now() + 300_000).toISOString() }, { status: 202 });
      }),
      http.post('*/api/v1/identity/stepup/verifications', () => HttpResponse.json({ id: 'session:owner', assurance_level: 3 })),
      http.get('*/api/v1/identity/session', () => HttpResponse.json({ ...ownerContext.session, assurance: { level: 3 } })),
      http.post('*/api/v1/access/ownership/transfers/preview', () => HttpResponse.json({
        proof: 'signed-owner-action-proof', proofExpiresAt: new Date(Date.now() + 300_000).toISOString(), ownershipVersion: 4,
        targetAccessVersion: 7, sourceMembership: 'membership:owner', targetMembership: 'membership:successor',
        formerOwnerMode: 'retain_admin', formerOwnerRole: 'role-platform-admin-v2', formerOwnerRoleVersion: 3,
      })),
      http.post('*/api/v1/access/ownership/transfers', () => HttpResponse.json({
        code: 'VERSION_CONFLICT', message: 'Ownership changed.', requestId: 'request:conflict',
      }, { status: 409 })),
    );
    renderPanel(ownerContext);
    await user.click(await screen.findByRole('button', { name: '发起 Owner 转让' }));
    await user.click(screen.getByRole('button', { name: '发送本人短信验证码' }));
    await user.type(await screen.findByLabelText('6 位短信验证码'), '123456');
    await user.click(screen.getByRole('button', { name: '验证并生成权威预览' }));
    expect(await screen.findByRole('heading', { name: '服务端权威预览' })).toBeTruthy();
    expect(screen.getByText('role-platform-admin-v2 / v3')).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: /我已核对目标/ }));
    await user.click(screen.getByRole('button', { name: '发起待确认转让' }));

    expect(await screen.findByText(/旧预览与 action proof 已丢弃/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '服务端权威预览' })).toBeNull();
    expect(screen.getByRole('button', { name: '发送本人短信验证码' })).toBeTruthy();
  });

  it('requires password then new-phone OTP for first Canonical enrollment and clears sensitive input before re-login', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    server.use(
      http.get('*/api/v1/access/ownership', () => HttpResponse.json({
        state: 'active', version: 4, mobileReady: false,
        owner: { membership: 'membership:owner', member: 'member:owner', principal: 'principal:owner', displayName: '当前 Owner' },
        candidates: [{ membership: 'membership:successor', member: 'member:successor', principal: 'principal:successor',
          displayName: '接任管理员', roles: ['普通管理员'], accessVersion: 7, mobileReady: true }],
        formerOwnerRoles: [{ id: 'role-platform-admin-v2', name: '平台管理员', version: 3 }], pending: null,
      })),
      http.post('*/api/v1/identity/password/verify', async ({ request }) => {
        calls.push('password.verify');
        expect(await request.json()).toEqual({ password: 'current-owner-password' });
        return HttpResponse.json({ verified: true, verifiedAt: '2026-08-29T10:00:00.000Z' });
      }),
      http.post('*/api/v1/identity/mobile/challenges', async ({ request }) => {
        calls.push('phone.challenge');
        expect(await request.json()).toEqual({ destination: '+8613800138000' });
        return HttpResponse.json({ id: 'challenge:mobile', purpose: 'phone_change',
          expires_at: new Date(Date.now() + 600_000).toISOString() }, { status: 202 });
      }),
      http.put('*/api/v1/identity/mobile', async ({ request }) => {
        calls.push('mobile.manage');
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token-from-session');
        expect(await request.json()).toEqual({ mobile: '+8613800138000', challenge: 'challenge:mobile', code: '654321' });
        return HttpResponse.json({ id: 'member:owner', display_name: '当前 Owner', mobile_masked: '+86****7586', version: 2 });
      }),
    );
    renderPanel(ownerContext);
    await user.click(await screen.findByRole('button', { name: '发起 Owner 转让' }));
    expect(await screen.findByRole('heading', { name: '先绑定 Canonical 安全手机号' })).toBeTruthy();
    await user.type(screen.getByLabelText('当前账户密码'), 'current-owner-password');
    await user.click(screen.getByRole('button', { name: '验证当前密码' }));
    await user.type(await screen.findByLabelText('中国大陆手机号'), '134 2432 7586');
    await user.click(screen.getByRole('button', { name: '获取绑定验证码' }));
    expect(await screen.findByText(/\+86 134\*\*\*\*7586/)).toBeTruthy();
    await user.type(screen.getByLabelText('6 位手机验证码'), '654321');
    await user.click(screen.getByRole('button', { name: '验证并绑定手机号' }));

    expect(await screen.findByText('手机号已通过验证并写入 Canonical 身份档案')).toBeTruthy();
    expect(screen.getByRole('button', { name: '使用新手机号重新登录' })).toBeTruthy();
    expect(screen.queryByDisplayValue('current-owner-password')).toBeNull();
    expect(screen.queryByDisplayValue('13800138000')).toBeNull();
    expect(screen.queryByDisplayValue('654321')).toBeNull();
    expect(calls).toEqual(['password.verify', 'phone.challenge', 'mobile.manage']);
  }, 15_000);

  it('keeps create disabled when every successor candidate lacks a Canonical security mobile', async () => {
    server.use(http.get('*/api/v1/access/ownership', () => HttpResponse.json({
      state: 'active', version: 4, mobileReady: true,
      owner: { membership: 'membership:owner', member: 'member:owner', principal: 'principal:owner', displayName: '当前 Owner' },
      candidates: [{ membership: 'membership:successor', member: 'member:successor', principal: 'principal:successor',
        displayName: '接任管理员', roles: ['普通管理员'], accessVersion: 7, mobileReady: false }],
      formerOwnerRoles: [{ id: 'role-platform-admin-v2', name: '平台管理员', version: 3 }], pending: null,
    })));
    renderPanel(ownerContext);
    const create = await screen.findByRole('button', { name: '发起 Owner 转让' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect(screen.getByText('没有合格接任人')).toBeTruthy();
    expect(screen.getByText(/尚未完成 Canonical 安全手机号绑定/)).toBeTruthy();
  });

  it('offers a pre-transfer enrollment path to an eligible admin without ownership visibility', async () => {
    const context: ConsoleContext = { ...targetContext, session: { ...targetContext.session,
      permissions: ['access.center.read', 'identity.assurance.manage', 'identity.mobile.manage'],
      capabilities: ['identity.password.verify', 'identity.mobile.challenge', 'identity.mobile.manage'],
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    } };

    renderPanel(context);

    expect(ownershipReads).toBe(0);
    expect(screen.getByText('Owner 状态保持关闭')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '先绑定 Canonical 安全手机号' })).toBeTruthy();
  });
});

const targetContext: ConsoleContext = {
  session: {
    actor: 'principal:successor', membership: 'membership:successor', accessVersion: 7,
    permissions: ['access.ownership.read', 'access.ownership.accept'],
    capabilities: ['access.ownership.read', 'access.ownership.transfers.accept.preview',
      'access.ownership.transfers.accept', 'identity.stepup.start', 'identity.stepup.complete',
      'identity.password.verify', 'identity.mobile.challenge', 'identity.mobile.manage'],
    target: 'console', scope: { kind: 'tenant', id: 'tenant-zhudatuan' },
    scopes: [{ kind: 'tenant', id: 'tenant-zhudatuan' }, { kind: 'self', id: 'principal:successor' }], assurance: { level: 1 },
    csrf: 'csrf-token-from-session', syncedAt: '2026-08-29T00:00:00.000Z',
  },
  profile: { display_name: '接任管理员', employee_no: null },
  scope: { kind: 'tenant', id: 'tenant-zhudatuan' },
  scopes: [{ kind: 'tenant', id: 'tenant-zhudatuan' }, { kind: 'self', id: 'principal:successor' }],
};

const ownerContext: ConsoleContext = {
  ...targetContext,
  session: {
    ...targetContext.session,
    actor: 'principal:owner', membership: 'membership:owner',
    scopes: [{ kind: 'tenant', id: 'tenant-zhudatuan' }, { kind: 'self', id: 'principal:owner' }],
    permissions: ['access.ownership.read', 'access.ownership.transfer'],
    capabilities: ['access.ownership.read', 'access.ownership.transfers.preview', 'access.ownership.transfers.create',
      'identity.stepup.start', 'identity.stepup.complete', 'identity.password.verify',
      'identity.mobile.challenge', 'identity.mobile.manage'],
  },
  profile: { display_name: '当前 Owner', employee_no: null },
  scopes: [{ kind: 'tenant', id: 'tenant-zhudatuan' }, { kind: 'self', id: 'principal:owner' }],
};

function renderPanel(context: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(<QueryClientProvider client={client}><OwnerTransferPanel context={context} /></QueryClientProvider>);
}
