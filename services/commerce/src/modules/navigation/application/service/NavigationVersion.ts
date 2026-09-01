import { createHash } from 'node:crypto';
import type { NavigationContext } from '../../domain/model/NavigationContext';

export function navigationVersion(catalog: string, context: NavigationContext): Readonly<{ version: string; etag: string }> {
  const version = createHash('sha256')
    .update(JSON.stringify({ catalog, target: context.target, principal: context.principal, membership: context.membership, scope: context.scope.id, access: context.accessVersion, capability: context.capabilityVersion }))
    .digest('hex');
  return Object.freeze({ version, etag: `\"navigation-${version}\"` });
}
