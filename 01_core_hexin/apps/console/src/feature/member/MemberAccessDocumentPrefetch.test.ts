// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

const api = vi.hoisted(() => ({ membersRead: vi.fn(), accessRead: vi.fn() }));
vi.mock('@shop/sdk/member', () => ({
  createFetchMemberMembersRead: () => api.membersRead,
  createFetchMemberProfileRead: () => vi.fn(),
}));
vi.mock('@shop/sdk/access', () => ({ createFetchAccessCenterRead: () => api.accessRead }));

import { readAccess } from '../access/AccessQuery';
import { readMembers } from './MemberQuery';

const memberPage = { items: [], count: 0 };
const accessPage = { items: [], count: 0, roles: [] };
const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['member.members.read', 'access.center.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};

afterEach(() => {
  delete window.__consoleMemberPrefetch;
  delete window.__consoleAccessPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.membersRead.mockReset();
  api.accessRead.mockReset();
});

describe('member management document prefetch', () => {
  it('uses both exact prefetched pages without repeating SDK requests', async () => {
    window.__consoleMemberPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: memberPage,
    });
    window.__consoleAccessPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: accessPage,
    });

    await Promise.all([
      expect(readMembers(context, undefined, new AbortController().signal)).resolves.toMatchObject({ count: 0 }),
      expect(readAccess(context, undefined, new AbortController().signal)).resolves.toMatchObject({ roles: [] }),
    ]);
    expect(api.membersRead).not.toHaveBeenCalled();
    expect(api.accessRead).not.toHaveBeenCalled();
  });

  it('falls back independently when cursor or scope differs', async () => {
    window.__consoleMemberPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, cursor: 'cursor:other', value: memberPage,
    });
    window.__consoleAccessPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:other', accessVersion: 7, value: accessPage,
    });
    api.membersRead.mockResolvedValue(memberPage);
    api.accessRead.mockResolvedValue(accessPage);

    await Promise.all([
      readMembers(context, undefined, new AbortController().signal),
      readAccess(context, undefined, new AbortController().signal),
    ]);
    expect(api.membersRead).toHaveBeenCalledOnce();
    expect(api.accessRead).toHaveBeenCalledOnce();
  });
});

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
