import handler from 'vinext/server/app-router-entry';
import { routePublicRequest } from '../../../services/commerce-api/src/api/routes/publicRouter';
import type { WorkerEnv } from '../../../services/commerce-api/src/api/types';
import { isShowcaseHostAllowed, isShowcasePath, isStorefrontRuntimeConfigurationAllowed } from '../src/config/showcaseAccess';

type Env = Parameters<typeof handler.fetch>[1] & WorkerEnv;

// vinext's Node prod-server (used by `vinext start` on plain Node hosts, e.g.
// pm2/systemd on a VM) invokes this fetch handler with env=undefined -- only
// Cloudflare Workers injects env natively. Node hosts must fall back to
// process.env, which pm2/systemd populate from an env file at process start.
function resolveEnv(env: Env | undefined): Env {
  if (env) return env;
  if (typeof process !== 'undefined' && process.env) return process.env as unknown as Env;
  return {} as Env;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: Parameters<typeof handler.fetch>[2]): Promise<Response> {
    const resolvedEnv = resolveEnv(env);
    const requestUrl = new URL(request.url);
    if (!isStorefrontRuntimeConfigurationAllowed(requestUrl.hostname, resolvedEnv.APP_ENV, resolvedEnv.AUTH_MODE)) {
      return new Response('Service Unavailable', {
        status: 503,
        headers: {
          'cache-control': 'no-store',
          'content-type': 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
        },
      });
    }
    if (isShowcasePath(requestUrl.pathname) && !isShowcaseHostAllowed(requestUrl.hostname, resolvedEnv.APP_ENV)) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'cache-control': 'no-store',
          'content-type': 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
        },
      });
    }
    const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
    const apiResponse = await routePublicRequest(request, resolvedEnv, requestId);
    if (apiResponse) {
      return apiResponse;
    }
    return handler.fetch(request, resolvedEnv, ctx);
  },
};

export default worker;
