import handler from 'vinext/server/app-router-entry';
import { routeApi } from '../../../services/commerce-api/src/api/router';
import type { WorkerEnv } from '../../../services/commerce-api/src/api/types';
import { resolveH5RuntimeRequest } from '../src/config/h5Runtime';
import { isLabsApiPathBlocked, isShowcaseHostAllowed, isShowcasePath, isStorefrontRuntimeConfigurationAllowed } from '../src/config/showcaseAccess';

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
    const runtimeRequest = resolveH5RuntimeRequest(request);
    const requestUrl = new URL(runtimeRequest.url);
    if (isLabsApiPathBlocked(requestUrl.hostname, requestUrl.pathname)) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'cache-control': 'no-store',
          'content-type': 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
        },
      });
    }
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
    const apiResponse = await routeApi(runtimeRequest, resolvedEnv);
    if (apiResponse) {
      return apiResponse;
    }
    return handler.fetch(runtimeRequest, resolvedEnv, ctx);
  },
};

export default worker;
