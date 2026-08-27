import { handleAccountLedgers, handleAccounts, handleBootstrap } from './accountRoutes';
import { json, methodNotAllowed } from './http';
import { handleOrders } from './orderRoutes';
import type { AuthorizationContext, WorkerEnv } from './types';

/**
 * Consolidates the authenticated storefront bootstrap. The router resolves the
 * membership once; individual handlers still retain their own permission
 * checks and RPC scopes. This avoids four separate browser round trips and
 * four duplicate membership-resolution RPCs on every refresh.
 */
export async function handleHomeSnapshot(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);

  const responses = await Promise.all([
    handleBootstrap(request, env, authorization, requestId),
    handleAccounts(request, env, authorization, requestId),
    handleOrders(request, env, authorization, requestId),
    handleAccountLedgers(request, env, authorization, requestId),
  ]);
  const failed = responses.find((response) => !response.ok);
  if (failed) return failed;

  const [bootstrap, accounts, orders, accountLedgers] = await Promise.all(responses.map((response) => response.json()));
  return json({ bootstrap, accounts, orders, accountLedgers, requestId });
}
