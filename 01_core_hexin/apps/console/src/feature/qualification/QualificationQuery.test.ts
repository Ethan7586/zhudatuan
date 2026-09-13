// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

const api = vi.hoisted(() => ({ centerRead: vi.fn() }));
vi.mock('@shop/sdk/qualification', () => ({
  createFetchQualificationCenterRead: () => api.centerRead,
}));

import { readQualifications } from './QualificationQuery';

const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['qualification.center.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};
const response = { items: [], count: 0 };

afterEach(() => {
  delete window.__consoleQualificationPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.centerRead.mockReset();
});

describe('qualification document prefetch', () => {
  it('uses the exact prefetched page without repeating the SDK request', async () => {
    window.__consoleQualificationPrefetch = { settled: true, promise: Promise.resolve({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: response,
    }) };

    await expect(readQualifications(context, undefined, new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(api.centerRead).not.toHaveBeenCalled();
  });

  it('falls back when the prefetched scope does not match', async () => {
    window.__consoleQualificationPrefetch = { settled: true, promise: Promise.resolve({
      scopeKind: 'mall', scopeId: 'mall:other', accessVersion: 7, value: response,
    }) };
    api.centerRead.mockResolvedValue(response);

    await readQualifications(context, undefined, new AbortController().signal);
    expect(api.centerRead).toHaveBeenCalledOnce();
  });
});
