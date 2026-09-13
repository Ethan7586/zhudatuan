// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

const api = vi.hoisted(() => ({
  programsRead: vi.fn(), librariesRead: vi.fn(), reservesRead: vi.fn(), batchesRead: vi.fn(),
}));
vi.mock('@shop/sdk/voucher', () => ({
  createFetchVoucherProgramsRead: () => api.programsRead,
  createFetchVoucherCardlibrariesRead: () => api.librariesRead,
  createFetchVoucherReservesRead: () => api.reservesRead,
  createFetchVoucherBatchesRead: () => api.batchesRead,
}));

import { readVouchers } from './VoucherQuery';

const response = { items: [], count: 0 };
const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['voucher.programs.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};

afterEach(() => {
  delete window.__consoleVoucherPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  Object.values(api).forEach((mock) => mock.mockReset());
});

describe('voucher document prefetch', () => {
  it('uses the exact selected voucher view', async () => {
    window.__consoleVoucherPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, view: 'programs', value: response,
    });

    await expect(readVouchers(context, 'programs', undefined, new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(api.programsRead).not.toHaveBeenCalled();
  });

  it('falls back when the selected view differs', async () => {
    window.__consoleVoucherPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, view: 'libraries', value: response,
    });
    api.programsRead.mockResolvedValue(response);

    await readVouchers(context, 'programs', undefined, new AbortController().signal);
    expect(api.programsRead).toHaveBeenCalledOnce();
  });
});

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
