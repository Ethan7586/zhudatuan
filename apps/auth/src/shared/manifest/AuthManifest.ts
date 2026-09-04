import type { OperationId } from '@shop/contract';
import { operationPolicy } from '@shop/contract/policies';
import { NAVIGATION_ROUTE_IDS } from '../../generated/NavigationBinding';
import { ROUTE_FEATURES, type RouteId } from '../../generated/RouteBinding';
import type { ComponentType } from 'react';

export interface AuthRouteModule {
  readonly Component: ComponentType;
}
export interface AuthManifest {
  readonly routeid: RouteId;
  readonly feature: string;
  readonly operation: OperationId;
  readonly scope: 'public' | 'preauth' | 'self';
  readonly capability: string;
  readonly permission: string | null;
  readonly title: string;
  readonly breadcrumbs: readonly string[];
  readonly load: () => Promise<AuthRouteModule>;
}

type AuthDefinition = Omit<AuthManifest, 'feature' | 'capability' | 'permission'>;

export function defineManifest(definition: AuthDefinition): AuthManifest {
  if (NAVIGATION_ROUTE_IDS.length !== 0) throw new Error('AUTH_NAVIGATION_MUST_REMAIN_SHELL_FREE');
  if (!/\p{Script=Han}/u.test(definition.title) || definition.breadcrumbs.length === 0 || definition.breadcrumbs.some((item) => item.trim().length === 0)) {
    throw new Error(`AUTH_MANIFEST_PRESENTATION_INVALID:${definition.routeid}`);
  }
  const policy = operationPolicy(definition.operation);
  return Object.freeze({
    ...definition,
    feature: ROUTE_FEATURES[definition.routeid],
    capability: policy.capability,
    permission: policy.permission,
    breadcrumbs: Object.freeze([...definition.breadcrumbs]),
  });
}
