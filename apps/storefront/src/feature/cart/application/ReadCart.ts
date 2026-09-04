import type { CartAccess, CartPort } from '../public/CartPort';

export class ReadCart {
  constructor(private readonly gateway: Pick<CartPort, 'read'>) {}
  execute(access: CartAccess, signal?: AbortSignal) {
    return this.gateway.read(access, signal);
  }
}
