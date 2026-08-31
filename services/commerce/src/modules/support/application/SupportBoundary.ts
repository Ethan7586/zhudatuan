import type { AccessContext } from '../../../foundation/security/AccessContext';
import { organizationScope } from '../../../foundation/security/OrganizationScope';

export function supportBoundary(access: Pick<AccessContext, 'actor' | 'organization' | 'scope'>): string {
  return access.actor.target === 'storefront' ? access.organization : organizationScope(access.scope);
}
