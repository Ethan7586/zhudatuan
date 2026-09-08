import { supplierEnvironment } from '@shop/config/supplier';
import type { SupplierSurfaceClient } from '@shop/sdk/surfaces';
import { createFetchSupplier } from '@shop/sdk/supplierclient';

export interface SupplierDependencies {
  readonly client: SupplierSurfaceClient;
  readonly environment: ReturnType<typeof supplierEnvironment>;
}

export function createSupplierDependencies(): SupplierDependencies {
  const environment = supplierEnvironment();
  return Object.freeze({ environment, client: createFetchSupplier(environment.apiOrigin) });
}
