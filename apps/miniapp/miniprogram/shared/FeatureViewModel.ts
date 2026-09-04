import type { MiniappSurfaceClient, RequestContext } from '@shop/sdk';
import type { RouteId, RouteMatch } from '../generated/RouteBinding';

export interface MiniappFeatureViewModel {
  readonly defaultRoute: RouteId;
  readonly routes: readonly RouteId[];
  readonly title: string;
  readonly description: string;
  read(client: MiniappSurfaceClient, context: RequestContext, route: RouteMatch): Promise<unknown>;
}

export function defineMiniappFeature(definition: MiniappFeatureViewModel): MiniappFeatureViewModel {
  if (definition.routes.length === 0 || !definition.routes.includes(definition.defaultRoute)) throw new Error('MINIAPP_FEATURE_ROUTE_INVALID');
  return Object.freeze({ ...definition, routes: Object.freeze([...definition.routes]) });
}
