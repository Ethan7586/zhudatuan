import type { AuthorizationContext, WorkerEnv } from '../types';

/** Legacy /api/v1/auth/* is intentionally absent from the production route table. */
export async function routeAuthenticatedRequest(_request: Request, _env: WorkerEnv, _authorization: AuthorizationContext,
  _requestId: string): Promise<Response | null> {
  return null;
}
