import type { RequestContext } from '@shop/sdk/context';
import type { StoreSurfaceClient } from '@shop/sdk/surfaces';
import { defineOperatorFeature, type OperatorFeature } from '@shop/presentation/operator';
import type { RouteId, RouteMatch } from '../generated/RouteBinding';

export type StoreFeatureViewModel = OperatorFeature<StoreSurfaceClient, RequestContext, RouteMatch> & Readonly<{ routes: readonly RouteId[] }>;

export function defineStoreViewModel(definition: StoreFeatureViewModel): StoreFeatureViewModel {
  return defineOperatorFeature(definition, 'STORE_VIEWMODEL_ROUTE_MISSING') as StoreFeatureViewModel;
}
