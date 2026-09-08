import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import type { MembershipSelector } from '../service/MembershipSelector';
import { requirePreauth } from '../../../../platform/security/OperationSecurityContext';
import { requestContext } from './StartFederation';
import type { SessionCookiePort } from '../port/SessionCookiePort';
export class SelectMembership {
  constructor(
    private readonly selector: MembershipSelector,
    private readonly cookies: SessionCookiePort
  ) {}
  action(): OperationAction {
    return async (request, database) => {
      const security = requirePreauth(request.security, 'federationselection');
      const body = bodyRecord(request.input);
      const context = requestContext(request);
      const session = await this.selector.select(database, security.id, textField(body, 'membershipid', 255), context);
      return { status: 303, headers: { ...session.headers, location: session.destination, 'x-clear-cookie': this.cookies.preauth('', 0) } };
    };
  }
}
