import { QueryClient } from '@tanstack/react-query';
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { prefetchMembers } from './MemberPrefetch';
import { belongsToMemberPartition, memberKey } from './MemberQuery';

const mall: ConsoleScope = { kind: 'mall', id: 'mall-hbbtzn', tenant: 'tenant-zhudatuan', name: '宏泰商城' };
const context = memberContext(mall, 'membership:owner');
let requests = 0;
let requestedLimit: string | null = null;
const server = setupServer(http.get('*/api/v1/members', async ({ request }) => {
  requests += 1;
  requestedLimit = new URL(request.url).searchParams.get('limit');
  await delay(20);
  return HttpResponse.json(memberPage('宏泰会员'));
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  requests = 0;
  requestedLimit = null;
});
afterAll(() => server.close());

describe('member page prefetch', () => {
  it('deduplicates concurrent prefetches and only reads the first 20 members', async () => {
    const client = queryClient();
    await Promise.all([prefetchMembers(client, context), prefetchMembers(client, context)]);

    expect(requests).toBe(1);
    expect(requestedLimit).toBe('20');
    expect(client.getQueryData(memberKey(context))).toEqual(memberPage('宏泰会员'));
    expect(prefetchMembers(client, context)).toBeUndefined();
    expect(requests).toBe(1);
  });

  it('partitions cached pages by login session and mall', () => {
    const hbbtznKey = memberKey(context);
    const otherMall = memberContext({ ...mall, id: 'mall-zhudatuan', name: '主打团商城' }, 'membership:owner');
    const otherSession = memberContext(mall, 'membership:other');

    expect(belongsToMemberPartition(hbbtznKey, context)).toBe(true);
    expect(belongsToMemberPartition(hbbtznKey, otherMall)).toBe(false);
    expect(belongsToMemberPartition(hbbtznKey, otherSession)).toBe(false);
  });

  it('does not prefetch outside a mall scope', () => {
    const platform = memberContext({ kind: 'platform', id: 'organization-platform-root' }, 'membership:owner');
    expect(prefetchMembers(queryClient(), platform)).toBeUndefined();
    expect(requests).toBe(0);
  });
});

function queryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function memberContext(scope: ConsoleScope, membership: string): ConsoleContext {
  return {
    session: {
      actor: `principal:${membership}`,
      membership,
      accessVersion: 7,
      permissions: [],
      capabilities: ['member.members.read'],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 2 },
      syncedAt: '2026-09-13T08:00:00.000Z',
    },
    profile: { display_name: 'Ethan', employee_no: null },
    scope,
    scopes: [scope],
  };
}

function memberPage(displayName: string) {
  return {
    items: [{
      id: 'member:one', display_name: displayName, status: 'active', membership_id: 'membership:one',
      employee_no: null, membership_status: 'active', access_version: 1, joined_at: null,
      principal_id: 'principal:one', principal_version: 1, client: 'operator', login_identity_bound: true,
      reset_allowed: false, reset_block_reason: null,
    }],
    count: 1,
  };
}
