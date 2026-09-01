import { IdentityAction as OperationAction } from '../model/IdentityAction';
import type { MembershipSelector } from '../service/MembershipSelector';
import { requirePreauth } from '../../../../foundation/security/OperationSecurityContext';
export class ReadMembershipSelection {
  constructor(private readonly selector: MembershipSelector) {}
  action(): OperationAction<'read'> {
    return async (request, database) => {
      const security = requirePreauth(request.security, 'federationselection');
      const preauth = await this.selector.read(database, security.id);
      return { status: 200, body: { memberships: preauth.memberships, expiresAt: preauth.expiresAt.toISOString(), target: preauth.target } };
    };
  }
}
