import { OP_IDENTITY_INVITATIONS_REVOKE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import type { Invitation } from '../model/Invitation';
import type { InvitationPort } from '../public';

export class RevokeInvitation {
  constructor(private readonly port: Pick<InvitationPort, 'revoke'>) {}
  execute(context: ConsoleContext, invitation: Invitation, reason: string, identity: string, signal?: AbortSignal) {
    if (!canUseOperation(context, OP_IDENTITY_INVITATIONS_REVOKE)) throw new Error('OPERATION_ACCESS_DENIED');
    if (context.session.assurance.level < requiredAssurance(OP_IDENTITY_INVITATIONS_REVOKE)) throw new Error('STEPUP_REQUIRED');
    if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
    if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    return this.port.revoke(context, invitation, reason, identity, signal);
  }
}
