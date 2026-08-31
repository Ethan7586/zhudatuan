import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { IdentityEventPort } from '../port/IdentityEventPort';

export class RevokeInvitation {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly events: IdentityEventPort
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const reason = textField(bodyRecord(request), 'reason', 1000);
      if (reason.trim().length < 4) throw new DomainError('VALIDATION_FAILED', { field: 'reason' });
      const result = await this.repository.revoke(database, request.input.path.id!, access.membership.id, reason, request.input.expectedVersion!);
      await this.events.publish(database, 'identity.invitation.revoked', 'invitation', request.input.path.id!, access.scope.id, access.trace, { invitationId: request.input.path.id!, actorMembershipId: access.membership.id });
      return { status: 200, body: result, headers: { etag: `"${String(result.version)}"` } };
    };
  }
}
