type ProductionApi = typeof import('./productionApi').productionApi;

let productionApiPromise: Promise<ProductionApi> | null = null;

export function loadProductionApi(): Promise<ProductionApi> {
  productionApiPromise ??= import('./productionApi').then(({ productionApi }) => productionApi);
  return productionApiPromise;
}
