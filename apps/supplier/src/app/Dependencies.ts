import { supplierEnvironment } from '@shop/config/supplier';
import { createFetchSurface, type SupplierSurfaceClient } from '@shop/sdk';

export interface SupplierDependencies {
  readonly client: SupplierSurfaceClient;
  readonly environment: ReturnType<typeof supplierEnvironment>;
}

export function createSupplierDependencies(): SupplierDependencies {
  const environment = supplierEnvironment();
  return Object.freeze({ environment, client: createFetchSurface('supplier', environment.apiOrigin) });
}
