import type { AccessContext } from '../../../../platform/security/AccessContext';
import { organizationScope } from '../../../../platform/security/OrganizationScope';
import { isConsumerTarget } from '@shop/contract';

export function supportBoundary(access: Pick<AccessContext, 'actor' | 'organization' | 'scope'>): string {
  if (exactSupportScope(access)) return access.scope.id;
  return isConsumerTarget(access.actor.target) ? access.organization : organizationScope(access.scope);
}

export function exactSupportScope(access: Pick<AccessContext, 'actor' | 'scope'>): boolean {
  return (access.actor.target === 'supplier' && access.scope.kind === 'supplier') || (access.actor.target === 'store' && access.scope.kind === 'store');
}
