import { IdentityAction as OperationAction } from '../model/IdentityAction';
import type { MembershipSelector } from '../service/MembershipSelector';
import { requirePreauth } from '../../../../platform/security/OperationSecurityContext';
import { membershipView } from '../model/MembershipCandidate';
export class ReadMembershipSelection {
  constructor(private readonly selector: MembershipSelector) {}
  action(): OperationAction<'read'> {
    return async (request, database) => {
      const security = requirePreauth(request.security, 'federationselection');
      const preauth = await this.selector.read(database, security.id);
      const memberships = preauth.memberships.map(membershipView);
      return { status: 200, body: { memberships, expiresAt: preauth.expiresAt.toISOString(), target: preauth.target } };
    };
  }
}
