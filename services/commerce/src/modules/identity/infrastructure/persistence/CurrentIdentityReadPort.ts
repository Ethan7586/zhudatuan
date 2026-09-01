import type { OperationSecurityContext } from '../../../../foundation/security/OperationSecurityContext';
import type { StorefrontIdentity, IdentityReadPort } from '../../public/IdentityReadPort';
import { requestCookie } from '../security/SessionCookie';
export class CurrentIdentityReadPort implements IdentityReadPort {
  resolve(security: OperationSecurityContext, headers: Readonly<Record<string, string>>): StorefrontIdentity {
    if (security.kind !== 'session') return Object.freeze({ state: 'anonymous', member: null, membership: null, scope: null, version: 0 });
    const { access } = security;
    if (access.actor.target !== 'storefront' || !access.membership.active) throw new Error('STOREFRONT_MEMBERSHIP_INVALID');
    const csrf = requestCookie(headers.cookie, '__Host-storefront-csrf');
    return Object.freeze({
      state: 'member',
      member: null,
      membership: access.membership.id,
      scope: access.scope.id,
      version: access.accessVersion,
      ...(csrf === undefined ? {} : { csrf }),
    });
  }
}
