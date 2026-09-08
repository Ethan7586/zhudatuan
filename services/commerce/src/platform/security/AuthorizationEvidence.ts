import type { OperationId } from '@shop/contract';
import type { AccessContext } from './AccessContext';

export type SystemAuthorizationSource = 'jobs' | 'provider' | 'scheduler' | 'migration';

/** Server-issued evidence for deferred work, never a substitute for reauthorization. */
export function authorizationEvidence(access: AccessContext, operation: OperationId, now: Date) {
  return Object.freeze({
    kind: 'user' as const,
    actor: access.actor.id,
    membership: access.actor.membership,
    organization: access.organization,
    scope: access.scope.id,
    target: access.actor.target,
    operation,
    accessVersion: access.accessVersion,
    credentialVersion: access.actor.credentialVersion,
    capabilityVersion: access.capabilityVersion,
    capturedAt: now.toISOString(),
  });
}

export function systemAuthorizationEvidence(
  context: Readonly<{ actor: string; scope: string; operation: string }>,
  source: SystemAuthorizationSource,
  now: Date
) {
  return Object.freeze({
    kind: 'system' as const,
    actor: context.actor,
    scope: context.scope,
    operation: context.operation,
    source,
    capturedAt: now.toISOString(),
  });
}
