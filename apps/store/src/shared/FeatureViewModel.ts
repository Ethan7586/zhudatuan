import type { RequestContext, StoreSurfaceClient } from '@shop/sdk';
import type { RouteId, RouteMatch } from '../generated/RouteBinding';

export interface StoreFeatureViewModel {
  readonly routes: readonly RouteId[];
  readonly title: string;
  readonly description: string;
  readonly read: (client: StoreSurfaceClient, context: RequestContext, route: RouteMatch) => Promise<unknown>;
}

export function defineStoreViewModel(definition: StoreFeatureViewModel): StoreFeatureViewModel {
  if (definition.routes.length === 0) throw new Error('STORE_VIEWMODEL_ROUTE_MISSING');
  return Object.freeze({ ...definition, routes: Object.freeze([...definition.routes]) });
}
