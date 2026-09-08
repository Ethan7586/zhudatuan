import type { RequestContext } from '@shop/sdk/context';
import type { SupplierSurfaceClient } from '@shop/sdk/surfaces';
import { defineOperatorFeature, type OperatorFeature } from '@shop/presentation/operator';
import type { RouteId, RouteMatch } from '../generated/RouteBinding';

export type SupplierFeatureViewModel = OperatorFeature<SupplierSurfaceClient, RequestContext, RouteMatch> & Readonly<{ routes: readonly RouteId[] }>;

export function defineSupplierViewModel(definition: SupplierFeatureViewModel): SupplierFeatureViewModel {
  return defineOperatorFeature(definition, 'SUPPLIER_VIEWMODEL_ROUTE_MISSING') as SupplierFeatureViewModel;
}
