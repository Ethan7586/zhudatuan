import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import type { MembershipSelector } from '../service/MembershipSelector';
import { requirePreauth } from '../../../../foundation/security/OperationSecurityContext';
export class ReadMembershipSelection {
  constructor(private readonly selector: MembershipSelector) {}
  action(): OperationAction {
    return async (request, database) => {
      const security = requirePreauth(request.security, 'federationselection');
      const preauth = await this.selector.read(database, security.id);
      return { status: 200, body: { memberships: preauth.memberships, expiresAt: preauth.expiresAt.toISOString(), target: preauth.target } };
    };
  }
}
