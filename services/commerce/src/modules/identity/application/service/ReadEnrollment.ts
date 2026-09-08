import { DomainError } from '../../../../platform/error/DomainError';
import { requirePreauth } from '../../../../platform/security/OperationSecurityContext';
import type { InvitationAccessPort } from '../../../access/public';
import type { IdentityRegistrationPort } from '../../../member/public';
import type { IdentityOrganizationPort } from '../../../organization/public/IdentityOrganizationPort';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { RegistrationPolicyRepository } from '../port/RegistrationPolicyRepository';
import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { registrationPolicyView } from './RegistrationPolicyView';
import { isConsumerTarget } from '@shop/contract';

export class ReadEnrollment {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly registrations: RegistrationPolicyRepository,
    private readonly access: InvitationAccessPort,
    private readonly members: IdentityRegistrationPort,
    private readonly organizations: IdentityOrganizationPort
  ) {}

  action(): OperationAction<'read'> {
    return async (request, database) => {
      const preauth = requirePreauth(request.security, 'enrollment');
      if (request.input.path.id !== preauth.reference || !isConsumerTarget(preauth.target)) throw new DomainError('PREAUTH_REQUIRED');
      const invitation = await this.repository.claimed(database, preauth.reference, 'storefront');
      if (!invitation.requiresEnrollment() || invitation.state.target !== preauth.target) throw new DomainError('INVITATION_INVALID');
      const [policy, organizations] = await Promise.all([
        invitation.state.policy ? this.registrations.read(database, invitation.state.policy, true) : Promise.resolve(null),
        this.organizations.names(database, [invitation.state.organization]),
      ]);
      const organization = organizations[0];
      if (!policy || !organization) throw new DomainError('INVITATION_INVALID');

      if (invitation.state.kind === 'campaign') {
        return {
          status: 200,
          body: {
            id: preauth.reference,
            kind: 'campaign',
            target: 'storefront',
            expiresAt: preauth.expires.toISOString(),
            subjectMode: 'input',
            organization: { id: organization.id, name: organization.name },
            policy: registrationPolicyView(policy),
          },
        };
      }
      if (!invitation.state.membership) throw new DomainError('INVITATION_INVALID');
      const pendingAccess = await this.access.pendingEmployee(database, invitation.state.membership);
      const pending = await this.members.pending(database, pendingAccess.member);
      if (preauth.principal !== pending.principal || !pending.mobileMasked) throw new DomainError('INVITATION_INVALID');
      return {
        status: 200,
        body: {
          id: preauth.reference,
          kind: 'enrollment',
          target: 'storefront',
          expiresAt: preauth.expires.toISOString(),
          subjectMode: 'bound',
          organization: { id: organization.id, name: organization.name },
          recipientMasked: pending.mobileMasked,
          employee: {
            displayName: pending.displayName,
            ...(pendingAccess.employeeNo ? { employeeNo: pendingAccess.employeeNo } : {}),
            ...(pendingAccess.departmentName ? { departmentName: pendingAccess.departmentName } : {}),
          },
          policy: registrationPolicyView(policy),
        },
      };
    };
  }
}
