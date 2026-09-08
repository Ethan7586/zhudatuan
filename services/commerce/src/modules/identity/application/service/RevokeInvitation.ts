import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireWriteTransaction } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';

import { requireAccess } from '../../../../pipeline/OperationAccess';

import { bodyRecord, textField } from '../../../../pipeline/Validation';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { IdentityEventRepository } from '../port/IdentityEventRepository';

export class RevokeInvitation {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly events: IdentityEventRepository
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const reason = textField(bodyRecord(request.input), 'reason', 1000);
      if (reason.trim().length < 4) throw new DomainError('VALIDATION_FAILED', { field: 'reason' });
      const result = await this.repository.revoke(requireWriteTransaction(database), request.input.path.id!, access.membership.id, reason, request.input.expectedVersion!);
      await this.events.publish(database, 'identity.invitation.revoked', 'invitation', request.input.path.id!, access.scope.id, access.trace, { invitationId: request.input.path.id!, actorMembershipId: access.membership.id });
      return { status: 200, body: result, headers: { etag: `"${String(result.version)}"` } };
    };
  }
}
