import { json } from '../http';
import { handleChangePassword, handleChangePhone, handleRevokeOtherSessions, handleRevokeSession, handleSecurityCenter } from '../securityCenterRoutes';
import { handleStepUp } from '../stepUpRoutes';
import type { AuthorizationContext, WorkerEnv } from '../types';

const API_PREFIX = '/api/v1';

/** Routes authenticated identity operations shared by storefront and admin memberships. */
export async function routeAuthenticatedRequest(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  switch (pathname) {
    case `${API_PREFIX}/auth/session`:
      return json({ authenticated: true, authorization: publicAuthorization(authorization), requestId });
    case `${API_PREFIX}/auth/step-up`:
      return handleStepUp(request, env, authorization, requestId);
    case `${API_PREFIX}/auth/security-center`:
      return handleSecurityCenter(request, env, authorization, requestId);
    case `${API_PREFIX}/auth/password/change`:
      return handleChangePassword(request, env, authorization, requestId);
    case `${API_PREFIX}/auth/phone/change`:
      return handleChangePhone(request, env, authorization, requestId);
    case `${API_PREFIX}/auth/sessions/revoke-others`:
      return handleRevokeOtherSessions(request, env, authorization, requestId);
  }

  const session = pathname.match(/^\/api\/v1\/auth\/sessions\/([0-9a-f-]{36})$/i);
  return session ? handleRevokeSession(request, env, authorization, session[1], requestId) : null;
}

function publicAuthorization(context: AuthorizationContext) {
  return {
    memberId: context.membership.memberId,
    membershipId: context.membership.id,
    target: context.membership.target,
    roles: context.roles,
    permissions: context.permissions,
  };
}
