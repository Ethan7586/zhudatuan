import { describe, expect, it } from 'vitest';
import type { AuthorizationContext, WorkerEnv } from '../types';
import { routeAdminRequest } from './adminRouter';
import { routeSimulationRequest } from './simulationRouter';
import { routeStorefrontRequest } from './storefrontRouter';

const env = { APP_ENV: 'test', AUTH_MODE: 'test' } as WorkerEnv;

function authorization(target: 'storefront' | 'admin'): AuthorizationContext {
  return { membership: { target } } as AuthorizationContext;
}

describe('business router target guards', () => {
  it('rejects an admin membership before a storefront handler is selected', async () => {
    await expect(routeStorefrontRequest(new Request('https://console.zhudatuan.com/api/v1/products'), env, authorization('admin'), 'admin-on-storefront')).resolves.toBeNull();
  });

  it('rejects a storefront membership before an admin handler is selected', async () => {
    await expect(routeAdminRequest(new Request('https://zhudatuan.com/api/v1/admin/overview'), env, authorization('storefront'), 'storefront-on-admin')).resolves.toBeNull();
  });

  it('keeps storefront simulation operations away from admin memberships', async () => {
    await expect(routeSimulationRequest(new Request('https://console.zhudatuan.com/api/v1/simulation/wallet'), env, authorization('admin'), 'admin-wallet')).resolves.toBeNull();
  });

  it('keeps admin simulation operations away from storefront memberships', async () => {
    await expect(routeSimulationRequest(new Request('https://zhudatuan.com/api/v1/simulation/benefits'), env, authorization('storefront'), 'storefront-benefits')).resolves.toBeNull();
  });
});
