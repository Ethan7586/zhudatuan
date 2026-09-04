import { OP_IDENTITY_INVITATIONS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import type { InvitationDraft } from '../model/InvitationDraft';
import type { InvitationPort } from '../public';

export class CreateInvitation {
  constructor(private readonly port: Pick<InvitationPort, 'create'>) {}
  execute(context: ConsoleContext, draft: InvitationDraft, identity: string, signal?: AbortSignal) {
    if (!canUseOperation(context, OP_IDENTITY_INVITATIONS_CREATE)) throw new Error('OPERATION_ACCESS_DENIED');
    if (context.session.assurance.level < requiredAssurance(OP_IDENTITY_INVITATIONS_CREATE)) throw new Error('STEPUP_REQUIRED');
    if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
    if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    return this.port.create(context, draft, identity, signal);
  }
}
