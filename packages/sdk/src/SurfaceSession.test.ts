import { describe, expect, it, vi } from 'vitest';
import { preloadSurfaceRoutes, selectSurfaceScope, SurfaceAccessRuntime, surfaceNavigationNodes } from './SurfaceSession';

describe('surface access runtime', () => {
  it('reuses the current session and navigation during a browser navigation burst', async () => {
    let now = 1_000;
    const client = clientFixture();
    const runtime = new SurfaceAccessRuntime(client as never, { target: 'store', clientVersion: '1.0.0' }, 'store', 'catalog:one', () => now);
    const signal = new AbortController().signal;

    const first = await runtime.session(signal);
    const scope = selectSurfaceScope(first, 'store');
    const navigation = await runtime.navigation(first, scope, signal);
    await expect(runtime.session(signal)).resolves.toBe(first);
    await expect(runtime.navigation(first, scope, signal)).resolves.toBe(navigation);
    expect(client.identity.sessionRead).toHaveBeenCalledTimes(1);
    expect(client.navigation.treeRead).toHaveBeenCalledTimes(1);
    expect(client.navigation.treeRead).toHaveBeenCalledWith({ query: { scopeid: 'store:one' } }, expect.objectContaining({ accessVersion: 1, csrfToken: 'csrf:one', scope: { kind: 'store', id: 'store:one' }, target: 'store' }));

    now += 30_000;
    await runtime.session(signal);
    await runtime.navigation(first, scope, signal);
    expect(client.identity.sessionRead).toHaveBeenCalledTimes(2);
    expect(client.navigation.treeRead).toHaveBeenCalledTimes(2);

    runtime.clear();
    await runtime.session(signal);
    expect(client.identity.sessionRead).toHaveBeenCalledTimes(3);
  });

  it('never returns cached access after cancellation', async () => {
    const client = clientFixture();
    const runtime = new SurfaceAccessRuntime(client as never, { target: 'store', clientVersion: '1.0.0' }, 'store', 'catalog:one');
    const controller = new AbortController();
    await runtime.session(controller.signal);
    controller.abort(new Error('cancelled'));
    await expect(runtime.session(controller.signal)).rejects.toThrow('cancelled');
  });

  it('flattens navigation and preloads only enabled route modules', async () => {
    const navigation = navigationFixture();
    const dashboard = vi.fn().mockResolvedValue({});
    const orders = vi.fn().mockResolvedValue({});
    const hidden = vi.fn().mockResolvedValue({});
    expect(surfaceNavigationNodes(navigation as never).map(({ key }) => key)).toEqual(['dashboard', 'orders', 'hidden']);
    preloadSurfaceRoutes(navigation as never, { storedashboard: { load: dashboard }, storeorders: { load: orders }, storehidden: { load: hidden } });
    await Promise.resolve();
    expect(dashboard).toHaveBeenCalledTimes(1);
    expect(orders).toHaveBeenCalledTimes(1);
    expect(hidden).not.toHaveBeenCalled();
  });
});

function clientFixture() {
  return {
    identity: { sessionRead: vi.fn().mockResolvedValue(sessionFixture()) },
    navigation: { treeRead: vi.fn().mockResolvedValue(navigationFixture()) },
  };
}

function sessionFixture() {
  return {
    target: 'store',
    actor: 'principal:one',
    session: 'session:one',
    membership: 'membership:one',
    scope: { kind: 'store', id: 'store:one' },
    scopes: [{ kind: 'store', id: 'store:one' }],
    accessVersion: 1,
    permissions: [],
    capabilities: [],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
    syncedAt: '2026-09-10T00:00:00Z',
    csrf: 'csrf:one',
  };
}

function navigationFixture() {
  return {
    target: 'store',
    scope: { kind: 'store', id: 'store:one' },
    catalogVersion: 'catalog:one',
    defaultKey: 'dashboard',
    nodes: [
      {
        key: 'dashboard',
        title: '首页',
        experience: { disabled: false, placement: 'primary', routeKey: 'storedashboard' },
        children: [
          { key: 'orders', title: '订单', experience: { disabled: false, placement: 'primary', routeKey: 'storeorders' }, children: [] },
          { key: 'hidden', title: '隐藏', experience: { disabled: true, placement: 'hidden', routeKey: 'storehidden' }, children: [] },
        ],
      },
    ],
  };
}
