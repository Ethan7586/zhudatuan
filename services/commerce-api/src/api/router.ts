import { resolveAuthorizationContext } from './auth';
import { knownApiError } from './errorResponse';
import { apiError } from './http';
import { routeAdminRequest } from './routes/adminRouter';
import { routePublicRequest } from './routes/publicRouter';
import { routeSimulationRequest } from './routes/simulationRouter';
import { routeStorefrontRequest } from './routes/storefrontRouter';
import type { WorkerEnv } from './types';

const API_PREFIX = '/api/v1';

/** The only API entrypoint: public first, then one authenticated business boundary. */
export async function routeApi(request: Request, env: WorkerEnv): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (pathname !== '/api/health' && !pathname.startsWith(`${API_PREFIX}/`)) return null;
  const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();

  try {
    const publicResponse = await routePublicRequest(request, env, requestId);
    if (publicResponse) return publicResponse;

    const authorization = await resolveAuthorizationContext(request, env);
    if (!authorization) {
      return apiError(401, 'AUTHENTICATION_REQUIRED', '生产身份认证尚未配置，服务端已拒绝匿名业务操作', requestId);
    }

    for (const route of [routeStorefrontRequest, routeAdminRequest, routeSimulationRequest]) {
      const response = await route(request, env, authorization, requestId);
      if (response) return response;
    }
    return apiError(404, 'API_NOT_FOUND', '接口不存在', requestId);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'api_request_failed',
        requestId,
        path: pathname,
        message: error instanceof Error ? error.message : 'unknown',
      })
    );
    return knownApiError(error, requestId);
  }
}
