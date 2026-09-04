import type { AccessContext } from '../../../../foundation/security/AccessContext';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { isConsumerTarget } from '@shop/contract';

export function supportBoundary(access: Pick<AccessContext, 'actor' | 'organization' | 'scope'>): string {
  return isConsumerTarget(access.actor.target) ? access.organization : organizationScope(access.scope);
}
