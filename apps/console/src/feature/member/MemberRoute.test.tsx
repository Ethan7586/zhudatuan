import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './MemberRoute';

let createCount = 0;
const server = setupServer(
  http.get('*/api/v1/members', () => HttpResponse.json(memberPage)),
  http.post('*/api/v1/identity/invitations', async () => {
    createCount += 1;
    await delay(30);
    return HttpResponse.json(invitationReceipt, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  createCount = 0;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
});
afterAll(() => server.close());

describe('Member invitation UI', () => {
  it.each([
    { permissions: [], capabilities: ['identity.invitations.create'], missing: 'permission' },
    { permissions: ['identity.invitation.manage'], capabilities: [], missing: 'capability' },
  ])('does not expose the action when $missing is absent', async ({ permissions, capabilities }) => {
    renderRoute(contextWith(permissions, capabilities));
    expect(await screen.findByRole('table', { name: '成员管理' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '生成普通管理员邀请码' })).toBeNull();
    expect(screen.getByText('Root Owner')).toBeTruthy();
  });

  it('shows, copies, and clears the one-time code without removing the member list', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderRoute(ownerContext);
    expect(await screen.findByText('Root Owner')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '生成普通管理员邀请码' }));
    const dialog = await screen.findByRole('dialog', { name: '生成普通管理员邀请码' });
    await user.type(within(dialog).getByLabelText('邀请标识'), '首轮平台主管邀请');
    await user.type(within(dialog).getByLabelText('受邀手机号'), '13800138000');
    const submit = within(dialog).getByRole('button', { name: '生成邀请码' });
    await user.dblClick(submit);

    const code = await within(dialog).findByLabelText('邀请码');
    expect(code).toHaveProperty('value', 'single-use-secret-code');
    expect(createCount).toBe(1);
    expect(screen.getByText('Root Owner')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: '复制邀请码' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('single-use-secret-code'));
    expect(within(dialog).getByRole('button', { name: '已复制' })).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: '关闭并清除' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '生成普通管理员邀请码' })).toBeNull());
    expect(screen.queryByDisplayValue('single-use-secret-code')).toBeNull();

    await user.click(screen.getByRole('button', { name: '生成普通管理员邀请码' }));
    const reopened = await screen.findByRole('dialog', { name: '生成普通管理员邀请码' });
    expect(within(reopened).queryByLabelText('邀请码')).toBeNull();
    expect(within(reopened).getByLabelText('邀请标识')).toHaveProperty('value', '');
  });

  it('renders a bounded API error without exposing response details or a stale code', async () => {
    server.use(http.post('*/api/v1/identity/invitations', () => HttpResponse.json({
      code: 'INVALID_INVITATION_INPUT',
      message: 'Invitation could not be created.',
      requestId: 'request:invite-failed',
      retryable: false,
      details: { debug_secret: 'must-not-render', invitation_code: 'also-must-not-render' },
    }, { status: 409 })));
    const user = userEvent.setup();
    renderRoute(ownerContext);
    await screen.findByRole('table', { name: '成员管理' });
    await user.click(screen.getByRole('button', { name: '生成普通管理员邀请码' }));
    const dialog = await screen.findByRole('dialog', { name: '生成普通管理员邀请码' });
    await user.type(within(dialog).getByLabelText('邀请标识'), '失败样本');
    await user.type(within(dialog).getByLabelText('受邀手机号'), '13800138000');
    await user.click(within(dialog).getByRole('button', { name: '生成邀请码' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('INVALID_INVITATION_INPUT');
    expect(alert.textContent).toContain('request:invite-failed');
    expect(dialog.textContent).not.toContain('must-not-render');
    expect(within(dialog).queryByLabelText('邀请码')).toBeNull();
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
    </MemoryRouter>,
  );
}

function contextWith(permissions: readonly string[], capabilities: readonly string[]): ConsoleContext {
  return {
    ...ownerContext,
    session: { ...ownerContext.session, permissions: [...permissions], capabilities: [...capabilities] },
  };
}

const ownerContext: ConsoleContext = {
  session: {
    actor: 'principal:owner', membership: 'membership:owner', accessVersion: 7,
    permissions: ['identity.invitation.manage'], capabilities: ['identity.invitations.create'], target: 'console',
    scope: { kind: 'platform', id: 'organization-platform-root', tenant: 'tenant:zhudatuan' },
    scopes: [
      { kind: 'platform', id: 'organization-platform-root', tenant: 'tenant:zhudatuan' },
      { kind: 'tenant', id: 'tenant:zhudatuan', tenant: 'tenant:zhudatuan' },
    ],
    assurance: { level: 2 }, csrf: 'csrf-token-owner-session', syncedAt: '2026-08-29T00:00:00.000Z',
  },
  profile: { display_name: 'Root Owner', employee_no: null },
  scope: { kind: 'platform', id: 'organization-platform-root', tenant: 'tenant:zhudatuan' },
  scopes: [
    { kind: 'platform', id: 'organization-platform-root', tenant: 'tenant:zhudatuan' },
    { kind: 'tenant', id: 'tenant:zhudatuan', tenant: 'tenant:zhudatuan' },
  ],
};

const memberPage = {
  items: [{
    id: 'profile:owner', display_name: 'Root Owner', status: 'active', membership_id: 'membership:owner',
    employee_no: null, membership_status: 'active', access_version: 7, joined_at: '2026-08-29T00:00:00.000Z',
  }],
  count: 1,
};

const invitationReceipt = {
  id: 'invite:ordinary-admin', label: '首轮平台主管邀请', code: 'single-use-secret-code', target_client: 'operator',
  max_uses: 1, use_count: 0, starts_at: '2026-08-29T00:00:00.000Z', expires_at: '2026-09-05T00:00:00.000Z',
  status: 'active', created_at: '2026-08-29T00:00:00.000Z', version: 0,
};
