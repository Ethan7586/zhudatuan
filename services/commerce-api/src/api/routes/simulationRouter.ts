import { apiError } from '../http';
import { handleSimulationBenefitIssue, handleSimulationMixedPayment, handleSimulationRecharge, handleSimulationWallet } from '../paymentSimulationRoutes';
import type { AuthorizationContext, WorkerEnv } from '../types';

const API_PREFIX = '/api/v1';

export async function routeSimulationRequest(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const isSimulationPath = pathname.startsWith(`${API_PREFIX}/simulation/`) || /^\/api\/v1\/orders\/[^/]+\/payments\/simulated$/.test(pathname);
  if (!isSimulationPath) return null;
  if (env.APP_ENV !== 'development' && env.APP_ENV !== 'test') {
    return apiError(404, 'API_NOT_FOUND', '接口不存在', requestId);
  }
  switch (pathname) {
    case `${API_PREFIX}/simulation/wallet`:
      return handleSimulationWallet(request, env, authorization, requestId);
    case `${API_PREFIX}/simulation/recharges`:
      return handleSimulationRecharge(request, env, authorization, requestId);
    case `${API_PREFIX}/simulation/benefits`:
      return handleSimulationBenefitIssue(request, env, authorization, requestId);
  }
  const payment = pathname.match(/^\/api\/v1\/orders\/([^/]+)\/payments\/simulated$/);
  return payment ? handleSimulationMixedPayment(request, env, authorization, decodeURIComponent(payment[1]), requestId) : null;
}
