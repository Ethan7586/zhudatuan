// @vitest-environment jsdom

import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ accessRead: vi.fn(), membersRead: vi.fn() }));
vi.mock('@shop/sdk/access', async (importOriginal) => ({
  ...await importOriginal<typeof import('@shop/sdk/access')>(),
  createFetchAccessCenterRead: () => api.accessRead,
}));
vi.mock('@shop/sdk/member', async (importOriginal) => ({
  ...await importOriginal<typeof import('@shop/sdk/member')>(),
  createFetchMemberMembersRead: () => api.membersRead,
}));

import { readMembers } from '../member/MemberQuery';
import { readAccess } from './AccessQuery';

const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['member.members.read', 'access.center.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-14T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};

afterEach(() => {
  delete window.__consoleMemberPrefetch;
  delete window.__consoleAccessPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.accessRead.mockReset();
  api.membersRead.mockReset();
});

describe('management document prefetch', () => {
  it('hydrates member and access pages without repeating their SDK reads', async () => {
    window.__consoleMemberPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: { items: [], count: 0 },
    });
    window.__consoleAccessPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: { items: [], count: 0, roles: [] },
    });
    const signal = new AbortController().signal;

    await expect(Promise.all([
      readMembers(context, undefined, signal),
      readAccess(context, undefined, signal),
    ])).resolves.toEqual([
      { items: [], count: 0 },
      { items: [], count: 0, roles: [] },
    ]);
    expect(api.membersRead).not.toHaveBeenCalled();
    expect(api.accessRead).not.toHaveBeenCalled();
  });

  it('rejects a prefetched page from a different scope', async () => {
    window.__consoleMemberPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:other', accessVersion: 7, value: { items: [], count: 0 },
    });
    api.membersRead.mockResolvedValue({ items: [], count: 0 });

    await readMembers(context, undefined, new AbortController().signal);
    expect(api.membersRead).toHaveBeenCalledOnce();
  });
});

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
