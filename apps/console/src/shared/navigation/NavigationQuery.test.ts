// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION_CATALOG_HASH } from '../../generated/NavigationBinding';
import type { ConsoleScope, ConsoleSession } from '../../entity/session/ConsoleSession';

const navigationTreeRead = vi.fn<(...arguments_: unknown[]) => Promise<unknown>>();
const consoleRequest = vi.fn((_scope: ConsoleScope, _signal: AbortSignal, _accessVersion: number, cache: Readonly<{ ifNoneMatch: string; cachedResponse: unknown }> | undefined) => ({ cache }));
vi.mock('../api/RequestContext', () => ({ consoleRequest }));
vi.mock('./NavigationGateway', () => ({ navigationTreeRead }));

const scope: ConsoleScope = { kind: 'mall', id: 'mall:one' };
const session: ConsoleSession = {
  actor: 'actor:one',
  membership: 'membership:one',
  scope,
  scopes: [scope],
  accessVersion: 7,
  permissions: [],
  capabilities: [],
  assurance: { level: 1 },
  security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
  target: 'console',
  syncedAt: '2026-08-30T00:00:00Z',
};
const tree = {
  scope,
  target: 'console' as const,
  version: '7:1',
  etag: '"navigation:one"',
  generatedAt: '2026-08-30T00:00:00Z',
  catalogVersion: NAVIGATION_CATALOG_HASH,
  nodes: [{ id: 'malldashboard', title: '数据', icon: 'dashboard', route: '/scopes/:scopeKind/:scopeId/cockpit', component: 'cockpit' as const, order: 1, entry: 'reporting.dashboard.read', disabled: false, children: [] }],
};

beforeEach(async () => {
  vi.clearAllMocks();
  const { clearConsoleNavigation } = await import('./NavigationQuery');
  clearConsoleNavigation();
});

describe('Console navigation query', () => {
  it('revalidates a versioned principal/scope cache using ETag', async () => {
    navigationTreeRead.mockResolvedValue(tree);
    const { readConsoleNavigation } = await import('./NavigationQuery');
    await readConsoleNavigation(session, scope, new AbortController().signal);
    await readConsoleNavigation(session, scope, new AbortController().signal);
    expect(consoleRequest.mock.calls[0]?.[3]).toBeUndefined();
    expect(consoleRequest.mock.calls[1]?.[3]).toEqual({ ifNoneMatch: tree.etag, cachedResponse: tree });
  });

  it('fails closed when the server catalog does not match the compiled binding', async () => {
    navigationTreeRead.mockResolvedValue({ ...tree, catalogVersion: 'stale' });
    const { readConsoleNavigation } = await import('./NavigationQuery');
    await expect(readConsoleNavigation(session, scope, new AbortController().signal)).rejects.toMatchObject({ status: 409 });
  });
});
