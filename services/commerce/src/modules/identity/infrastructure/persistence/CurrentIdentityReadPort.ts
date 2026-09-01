import type { OperationSecurityContext } from '../../../../foundation/security/OperationSecurityContext';
import type { StorefrontIdentity, IdentityReadPort } from '../../public/IdentityReadPort';
export class CurrentIdentityReadPort implements IdentityReadPort {
  resolve(security: OperationSecurityContext): StorefrontIdentity {
    if (security.kind !== 'session') return Object.freeze({ state: 'anonymous', member: null, membership: null, scope: null, version: 0 });
    const { access } = security;
    if (access.actor.target !== 'storefront' || !access.membership.active) throw new Error('STOREFRONT_MEMBERSHIP_INVALID');
    return Object.freeze({
      state: 'member',
      member: null,
      membership: access.membership.id,
      scope: access.scope.id,
      version: access.accessVersion,
    });
  }
}
