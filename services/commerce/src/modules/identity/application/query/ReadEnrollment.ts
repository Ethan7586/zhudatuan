import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requirePreauth } from '../../../../foundation/security/OperationSecurityContext';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { RegistrationPolicyRepository } from '../port/RegistrationPolicyRepository';
import { registrationPolicyView } from './RegistrationPolicyView';

export class ReadEnrollment {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly registrations: RegistrationPolicyRepository
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const preauth = requirePreauth(request.security, 'enrollment');
      if (request.input.path.id !== preauth.reference) throw new DomainError('PREAUTH_REQUIRED');
      const invitation = await this.repository.claimed(database, preauth.reference, preauth.target, false);
      if (invitation.state.kind !== 'enrollment' && invitation.state.kind !== 'campaign') throw new DomainError('INVITATION_INVALID');
      const policy = invitation.state.policy ? await this.registrations.read(database, invitation.state.policy, true) : null;
      if (!policy) throw new DomainError('INVITATION_STALE');
      return { status: 200, body: { id: preauth.reference, target: preauth.target, expiresAt: preauth.expires.toISOString(), policy: registrationPolicyView(policy) } };
    };
  }
}
