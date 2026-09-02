import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { MemberAccessWorkspace } from './MemberAccessWorkspace';

const scope: ConsoleScope = { kind: 'platform', id: 'organization-platform-root', name: '主打团平台' };
const context: ConsoleContext = {
  session: {
    actor: 'principal:owner',
    membership: 'membership:owner',
    accessVersion: 7,
    permissions: [],
    capabilities: ['member.members.read'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 2 },
    syncedAt: '2026-09-02T11:14:00.000Z',
  },
  profile: { display_name: 'Ethan', employee_no: null },
  scope,
  scopes: [scope],
};

const server = setupServer(
  http.get('*/api/v1/members', async ({ request }) => {
    const cursor = new URL(request.url).searchParams.get('cursor');
    if (cursor !== null) {
      await delay(250);
      return HttpResponse.json({ items: [member('member:second', '第二页成员')], count: 1 });
    }
    return HttpResponse.json({
      items: [member('member:first', '第一页成员')],
      count: 1,
      nextCursor: 'cursor:second',
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('member directory pagination', () => {
  it('keeps the current page visible while the next cursor page loads', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect((await screen.findAllByText('第一页成员')).length).toBeGreaterThan(0);
    expect(screen.getByText('治理邀请人')).toBeTruthy();
    expect(screen.getByText('Ethan')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '下一页' }));

    expect(screen.getAllByText('第一页成员').length).toBeGreaterThan(0);
    expect(screen.queryByText('正在读取真实会员与授权关系…')).toBeNull();
    expect(screen.getByRole('button', { name: '加载中…' }).hasAttribute('disabled')).toBe(true);

    expect((await screen.findAllByText('第二页成员')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('第一页成员')).toHaveLength(0);
  });
});

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/scopes/platform/organization-platform-root/settings/members']}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <MemberAccessWorkspace primary="members" />
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function member(id: string, displayName: string) {
  return {
    id,
    display_name: displayName,
    status: 'active',
    membership_id: `membership:${id}`,
    employee_no: null,
    membership_status: 'active',
    access_version: 7,
    joined_at: '2026-09-02T03:28:35.000Z',
    principal_id: `principal:${id}`,
    principal_version: 1,
    client: 'operator',
    login_identity_bound: true,
    reset_allowed: false,
    reset_block_reason: null,
    governance_parent_membership_id: 'membership:owner',
    governance_parent_name: 'Ethan',
  };
}
