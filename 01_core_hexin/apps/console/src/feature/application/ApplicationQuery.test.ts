// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

const api = vi.hoisted(() => ({ applicationsRead: vi.fn() }));
vi.mock('@shop/sdk/experience', () => ({ createFetchExperienceApplicationsRead: () => api.applicationsRead }));

import { readApplications } from './ApplicationQuery';

const response = { items: [], count: 0 };
const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['experience.applications.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};

afterEach(() => {
  delete window.__consoleApplicationPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.applicationsRead.mockReset();
});

describe('application document prefetch', () => {
  it('uses the exact prefetched store-decoration page', async () => {
    window.__consoleApplicationPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: response,
    });

    await expect(readApplications(context, undefined, new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(api.applicationsRead).not.toHaveBeenCalled();
  });

  it('falls back when the cursor does not match', async () => {
    window.__consoleApplicationPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, cursor: 'cursor:other', value: response,
    });
    api.applicationsRead.mockResolvedValue(response);

    await readApplications(context, undefined, new AbortController().signal);
    expect(api.applicationsRead).toHaveBeenCalledOnce();
  });
});

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
