import type { Listing, Pool, PoolAllocationKind } from '../model/Product';
import type { ProductCommand, ProductPort } from '../public';
import { OP_CATALOG_POOLS_ALLOCATE, OP_CATALOG_POOLS_ATTACH, OP_CATALOG_POOLS_DETACH } from '@shop/contract/ids';

export type PoolChange =
  | Readonly<{ operation: typeof OP_CATALOG_POOLS_ALLOCATE; target: string; poolkind: PoolAllocationKind; name: string }>
  | Readonly<{ operation: typeof OP_CATALOG_POOLS_ATTACH | typeof OP_CATALOG_POOLS_DETACH; target: string }>;

export class ChangePool {
  constructor(private readonly port: Pick<ProductPort, 'allocatePool' | 'changePoolBinding' | 'changeListingPool'>) {}
  execute(request: ProductCommand, pool: Pool, change: PoolChange) {
    if (change.operation === OP_CATALOG_POOLS_ALLOCATE) return this.port.allocatePool(request, pool, change.target, change.poolkind, change.name);
    return this.port.changePoolBinding(request, pool, change.target, change.operation === OP_CATALOG_POOLS_ATTACH);
  }
  move(request: ProductCommand, listing: Listing, pool: Pool | null) {
    return this.port.changeListingPool(request, listing, pool?.id ?? null);
  }
}
