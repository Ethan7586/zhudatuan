import type { Telemetry } from '@shop/telemetry';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import type { OperationRequest } from '../../../../pipeline/OperationRequest';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';
import type { PreparedInvitation } from './InvitationCreation';

export function publishInvitation(
  events: IdentityEventRepository,
  context: WriteTransactionContext,
  request: OperationRequest,
  invitation: string,
  scope: string,
  kind: PreparedInvitation['kind'],
  target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier',
  membership: string | null
): Promise<void> {
  const actor = requireAccess(request);
  return events.publish(context, 'identity.invitation.issued', 'invitation', invitation, scope, actor.trace, { invitationId: invitation, kind, target, membershipId: membership });
}

export function recordInvitation(telemetry: Telemetry, request: OperationRequest, kind: PreparedInvitation['kind'], result: 'success' | 'failure', errorCode?: string): void {
  const actor = requireAccess(request);
  telemetry.metrics.count('identity_invitation_issued_total', 1, {
    requestId: actor.trace,
    traceId: actor.trace,
    module: 'identity',
    operation: request.type,
    result,
    resourceType: kind,
    target: kind === 'signin' ? 'variable' : 'storefront',
    ...(errorCode === undefined ? {} : { errorCode }),
  });
}
