import handler from 'vinext/server/app-router-entry';
import { routeApi } from '../../../services/commerce-api/src/api/router';
import type { WorkerEnv } from '../../../services/commerce-api/src/api/types';

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
    const apiResponse = await routeApi(request, resolvedEnv);
    if (apiResponse) {
      return apiResponse;
    }
    return handler.fetch(request, resolvedEnv, ctx);
  },
};

export default worker;
