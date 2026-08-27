import { decide } from '@smart-wing/authz';
import type { AuthorizationDecision, Permission, ResourceScope } from '@smart-wing/api-contract';
import { resolveMembershipRuntime } from './membershipContext';
import type { AuthorizationContext, WorkerEnv } from './types';

/**
 * Resolves exactly one membership bound into the host-only signed session.
 * The previous api_resolve_actor / header-based development path is retired:
 * authorization always starts with resolveMembershipContext on every request.
 */
export async function resolveAuthorizationContext(request: Request, env: WorkerEnv): Promise<AuthorizationContext | null> {
  const runtime = await resolveMembershipRuntime(request, env);
  return runtime?.authorization ?? null;
}

/**
 * Applies the pure RBAC + Scope decision to a scope projection assembled only
 * from the server-side Membership context. Resource-specific routes must load
 * their target row first and pass that row's scope to authorize().
 */
export function authorize(context: AuthorizationContext, permission: Permission, resourceScope: ResourceScope = contextResourceScope(context)): AuthorizationDecision {
  return decide(context.membership, permission, resourceScope, { stepUpAt: context.stepUpAt });
}

export function can(context: AuthorizationContext, permission: Permission, resourceScope?: ResourceScope): boolean {
  return authorize(context, permission, resourceScope).allowed;
}

export function contextResourceScope(context: AuthorizationContext): ResourceScope {
  return {
    tenantId: context.tenantId,
    enterpriseId: context.enterpriseId,
    mallId: context.mallId,
    ownerUserId: context.userId,
  };
}
