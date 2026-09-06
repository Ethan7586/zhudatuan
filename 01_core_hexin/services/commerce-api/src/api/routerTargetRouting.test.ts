import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext, WorkerEnv } from './types';

const routes = vi.hoisted(() => ({
  resolveAuthorizationContext: vi.fn(),
  public: vi.fn(),
  authenticated: vi.fn(),
  storefront: vi.fn(),
  admin: vi.fn(),
  simulation: vi.fn(),
}));

vi.mock('./auth', () => ({ resolveAuthorizationContext: routes.resolveAuthorizationContext }));
vi.mock('./routes/publicRouter', () => ({ routePublicRequest: routes.public }));
vi.mock('./routes/authenticatedRouter', () => ({ routeAuthenticatedRequest: routes.authenticated }));
vi.mock('./routes/storefrontRouter', () => ({ routeStorefrontRequest: routes.storefront }));
vi.mock('./routes/adminRouter', () => ({ routeAdminRequest: routes.admin }));
vi.mock('./routes/simulationRouter', () => ({ routeSimulationRequest: routes.simulation }));

import { routeApi } from './router';

const env = {} as WorkerEnv;

function authorization(target: 'storefront' | 'admin'): AuthorizationContext {
  return { membership: { target } } as AuthorizationContext;
}

describe('authenticated target routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routes.public.mockResolvedValue(null);
    routes.authenticated.mockResolvedValue(null);
    routes.storefront.mockResolvedValue(null);
    routes.admin.mockResolvedValue(null);
    routes.simulation.mockResolvedValue(null);
  });

  it('never dispatches a storefront membership into the admin router', async () => {
    routes.resolveAuthorizationContext.mockResolvedValue(authorization('storefront'));

    const response = await routeApi(new Request('https://zhudatuan.com/api/v1/admin/overview'), env);

    expect(response?.status).toBe(404);
    expect(routes.storefront).toHaveBeenCalledOnce();
    expect(routes.admin).not.toHaveBeenCalled();
  });

  it('never dispatches an admin membership into the storefront router', async () => {
    routes.resolveAuthorizationContext.mockResolvedValue(authorization('admin'));

    const response = await routeApi(new Request('https://console.zhudatuan.com/api/v1/orders'), env);

    expect(response?.status).toBe(404);
    expect(routes.admin).toHaveBeenCalledOnce();
    expect(routes.storefront).not.toHaveBeenCalled();
  });

  it.each(['storefront', 'admin'] as const)('keeps retired auth routes outside the %s session chain', async (target) => {
    routes.resolveAuthorizationContext.mockResolvedValue(authorization(target));
    routes.authenticated.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await routeApi(new Request(`https://${target === 'admin' ? 'console.zhudatuan.com' : 'zhudatuan.com'}/api/v1/auth/session`), env);

    expect(response?.status).toBe(404);
    expect(routes.resolveAuthorizationContext).not.toHaveBeenCalled();
    expect(routes.authenticated).not.toHaveBeenCalled();
    expect(routes.storefront).not.toHaveBeenCalled();
    expect(routes.admin).not.toHaveBeenCalled();
    expect(routes.simulation).not.toHaveBeenCalled();
  });
});
