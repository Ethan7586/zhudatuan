import { createHash } from 'node:crypto';
import type { NavigationContext } from '../../domain/model/NavigationContext';

const NAVIGATION_PROJECTION_VERSION = 2;

export function navigationVersion(catalog: string, context: NavigationContext): Readonly<{ version: string; etag: string; featureVersion: string }> {
  const featureVersion = navigationFeatureVersion(context.featureFlags);
  const version = createHash('sha256')
    .update(
      JSON.stringify({ catalog, target: context.target, principal: context.principal, membership: context.membership, scope: context.scope.id, access: context.accessVersion, capability: context.capabilityVersion, feature: featureVersion })
    )
    .digest('hex');
  return Object.freeze({ version, etag: `\"navigation-${version}\"`, featureVersion });
}

export function navigationFeatureVersion(flags: ReadonlySet<string>): string {
  return createHash('sha256')
    .update(JSON.stringify({ projection: NAVIGATION_PROJECTION_VERSION, flags: [...flags].sort() }))
    .digest('hex');
}
