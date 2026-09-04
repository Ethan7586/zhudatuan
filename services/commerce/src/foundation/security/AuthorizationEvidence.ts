import type { OperationId } from '@shop/contract';
import type { AccessContext } from './AccessContext';

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
