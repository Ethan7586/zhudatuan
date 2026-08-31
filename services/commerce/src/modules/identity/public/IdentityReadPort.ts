import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationSecurityContext } from '../../../foundation/security/OperationSecurityContext';

export interface StorefrontIdentity {
  readonly state: 'anonymous' | 'member';
  readonly member: string | null;
  readonly membership: string | null;
  readonly scope: string | null;
  readonly version: number;
}

export interface IdentityReadPort {
  resolve(security: OperationSecurityContext): StorefrontIdentity;
}

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

export const IDENTITY_READ_PORT = publicPort<IdentityReadPort>('identity', 'read');
