import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DependencyProvider } from '../../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../../entity/session/StepupContext';
import { streamingFile } from '../../../../../test/StreamingFile';
import { Component } from './MemberRoute';

const server = setupServer(
  http.get('*/api/v1/members', () =>
    HttpResponse.json({
      items: [
        {
          id: 'member:one',
          display_name: '李小明',
          status: 'active',
          membership_id: 'membership:internal',
          organization_id: 'mall:server-owned',
          employee_no: 'E1002',
          membership_status: 'suspended',
          access_version: 8,
          joined_at: '2026-09-03T00:00:00.000Z',
          login_identity_bound: true,
          registration_reset_allowed: true,
          registration_reset_block_reason: null,
        },
      ],
      count: 1,
    })
  )
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('MemberRoute', () => {
  it('renders service-owned member state and scope without exposing membership ids', async () => {
    renderRoute();
    expect(await screen.findByText('李小明')).toBeTruthy();
    expect(screen.getByText('已暂停')).toBeTruthy();
    expect(screen.getByText(/组织范围/)).toBeTruthy();
    expect(screen.queryByText('membership:internal')).toBeNull();
  });

  it('routes member creation through the one-time enrollment invitation flow', async () => {
    renderRoute(false, { ...context, session: { ...context.session, permissions: ['member.read', 'identity.invitation.issue'], capabilities: ['member.members.read', 'identity.invitations.create'] } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '邀请成员' }));
    expect(screen.getByTestId('location').textContent).toBe('/scopes/mall/mall%3Aroute/settings/invitations');
  });

  it('moves an accepted member import into the durable task center route', async () => {
    server.use(
      http.post('*/api/v1/runtime/uploads', async ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBeTruthy();
        expect(await request.json()).toEqual({
          name: 'members.csv',
          contentType: 'text/csv',
          size: 25,
          sha256: 'bb16681c7c5b0159ea4479efefd8b675f480f8c70879f7bd0043a8c490d4e5f1',
        });
        return HttpResponse.json({
          reference: 'object:clean:members',
          path: 'imports/members.csv',
          sha256: 'bb16681c7c5b0159ea4479efefd8b675f480f8c70879f7bd0043a8c490d4e5f1',
          size: 25,
          contentType: 'text/csv',
          retentionUntil: '2099-09-05T00:00:00.000Z',
          upload: { url: 'https://objects.test/imports/members.csv', method: 'PUT', headers: { 'content-type': 'text/csv' }, expiresAt: '2099-09-05T00:00:00.000Z' },
        });
      }),
      http.put('https://objects.test/imports/members.csv', ({ request }) => {
        expect(request.credentials).toBe('omit');
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('*/api/v1/members/imports', async ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBeTruthy();
        expect(await request.json()).toEqual({ objectRef: 'object:clean:members', sha256: 'bb16681c7c5b0159ea4479efefd8b675f480f8c70879f7bd0043a8c490d4e5f1', fileName: 'members.csv' });
        return HttpResponse.json(
          { id: 'import:new', state: 'uploaded', total_count: 0, cursor_value: 0, success_count: 0, failure_count: 0, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' },
          { status: 202 }
        );
      })
    );
    renderRoute(true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '批量导入' }));
    const file = screen.getByLabelText<HTMLInputElement>('选择导入文件');
    await user.upload(file, streamingFile('employee_no,display_name\n', 'members.csv', 'text/csv'));
    expect(typeof file.files?.[0]?.stream).toBe('function');
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: '上传并开始预检' });
    expect(submit.disabled).toBe(false);
    expect(submit.form?.checkValidity()).toBe(true);
    await user.click(submit);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/scopes/mall/mall%3Aroute/imports/member/import%3Anew'));
  });

  it('preserves the LI owner-password and impact-confirmation reset flow without leaking the password', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('*/api/v1/identity/password/verify', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ verified: true, verifiedAt: '2026-09-04T12:00:00.000Z' });
      }),
      http.put('*/api/v1/identity/members/:membershipid', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          action: 'registrationReset', memberId: 'member:one', principalId: 'principal:one', status: 'reset',
          loginIdentityReleased: true, historyRetained: true, memberships: ['membership:internal'], accessVersion: 9,
          profileVersion: 4, principalVersion: 6,
        });
      })
    );
    renderRoute(false, resetContext);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '重置注册身份' }));
    expect(screen.getByText('这不是删除成员或业务资料')).toBeTruthy();
    await user.type(screen.getByLabelText('操作原因'), '重新邀请该成员注册');
    await user.click(screen.getByLabelText('我理解身份重置不可撤销，且历史业务记录不会被删除。'));
    await user.type(screen.getByLabelText('输入“重置”确认'), '重置');
    await user.type(screen.getByLabelText('当前所有者密码'), 'Owner!Password1');
    await user.click(screen.getByRole('button', { name: '验证密码并重置' }));
    expect(await screen.findByText('原登录手机号已释放')).toBeTruthy();
    expect(bodies).toEqual([{ password: 'Owner!Password1' }, { action: 'registrationReset', reason: '重新邀请该成员注册' }]);
  });

  it('authoritatively rereads a version conflict without discarding the local member draft', async () => {
    let reads = 0;
    server.use(
      http.get('*/api/v1/members', () => HttpResponse.json(memberPage(reads++ === 0 ? { display_name: '李小明', access_version: 8 } : { display_name: '李小明（人事已更新）', access_version: 9 }))),
      http.put('*/api/v1/identity/members/:membershipid', () =>
        HttpResponse.json({ code: 'VERSION_CONFLICT', message: 'VERSION_CONFLICT', requestId: 'request:member-conflict', retryable: true }, { status: 409 })
      )
    );
    renderRoute(false, resetContext);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '编辑成员' }));
    await user.clear(screen.getByLabelText('显示名称'));
    await user.type(screen.getByLabelText('显示名称'), '李小明（本地草稿）');
    await user.type(screen.getByLabelText('审计原因'), '同步最新花名册名称');
    await user.click(screen.getByRole('button', { name: '保存变更' }));

    const conflict = await screen.findByRole('alert', { name: '成员并发冲突' });
    expect(conflict.textContent).toContain('权限版本：第 8 版 → 第 9 版');
    expect(conflict.textContent).toContain('李小明 → 李小明（人事已更新）');
    expect(screen.getByLabelText<HTMLInputElement>('显示名称').value).toBe('李小明（本地草稿）');
    await user.click(screen.getByRole('button', { name: '使用最新状态继续编辑' }));
    expect(screen.queryByRole('alert', { name: '成员并发冲突' })).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('显示名称').value).toBe('李小明（本地草稿）');
  });

  it('clears the owner password immediately when password verification fails', async () => {
    server.use(
      http.post('*/api/v1/identity/password/verify', () =>
        HttpResponse.json({ code: 'CREDENTIAL_INVALID', message: 'CREDENTIAL_INVALID', requestId: 'request:password', retryable: false }, { status: 401 })
      )
    );
    renderRoute(false, resetContext);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '重置注册身份' }));
    await user.type(screen.getByLabelText('操作原因'), '重新邀请该成员注册');
    await user.click(screen.getByLabelText('我理解身份重置不可撤销，且历史业务记录不会被删除。'));
    await user.type(screen.getByLabelText('输入“重置”确认'), '重置');
    const password = screen.getByLabelText<HTMLInputElement>('当前所有者密码');
    await user.type(password, 'Wrong!Password1');
    await user.click(screen.getByRole('button', { name: '验证密码并重置' }));
    await screen.findByRole('alert');
    expect(password.value).toBe('');
  });
});

function renderRoute(privileged = false, override?: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const value = override ?? (privileged ? { ...context, session: { ...context.session, permissions: ['member.read', 'member.import'], capabilities: ['member.members.read', 'member.imports.create'] } } : context);
  render(
    <MemoryRouter>
      <LocationProbe />
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={value}>
            <StepupProvider controller={{ request: () => undefined }}>
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}
function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}
const scope = { kind: 'mall', id: 'mall:route', name: '路由商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:admin',
    accessVersion: 7,
    permissions: ['member.read'],
    capabilities: ['member.members.read'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope,
  scopes: [scope],
};
const resetContext: ConsoleContext = {
  ...context,
  session: {
    ...context.session,
    permissions: ['member.read', 'member.manage', 'identity.assurance.manage', 'identity.registration.reset'],
    capabilities: ['member.members.read', 'identity.members.manage', 'identity.password.verify'],
  },
};

function memberPage(change: Readonly<{ display_name: string; access_version: number }>) {
  return {
    items: [
      {
        id: 'member:one', display_name: change.display_name, status: 'active', membership_id: 'membership:internal',
        organization_id: 'mall:server-owned', employee_no: 'E1002', membership_status: 'suspended',
        access_version: change.access_version, joined_at: '2026-09-03T00:00:00.000Z', login_identity_bound: true,
        registration_reset_allowed: true, registration_reset_block_reason: null,
      },
    ],
    count: 1,
  };
}
