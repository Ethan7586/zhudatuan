import type { Pool } from '../model/Product';
import type { ProductCommand, ProductPort } from '../public';

export type PoolChange = Readonly<{ kind: 'allocate'; target: string; poolkind: 'channel' | 'markup'; name: string }> | Readonly<{ kind: 'attach' | 'detach'; target: string }>;

export class ChangePool {
  constructor(private readonly port: Pick<ProductPort, 'allocatePool' | 'changePoolBinding'>) {}
  execute(request: ProductCommand, pool: Pool, change: PoolChange) {
    if (change.kind === 'allocate') return this.port.allocatePool(request, pool, change.target, change.poolkind, change.name);
    return this.port.changePoolBinding(request, pool, change.target, change.kind === 'attach');
  }
}
