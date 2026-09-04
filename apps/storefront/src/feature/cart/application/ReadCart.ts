import type { StorefrontSession } from '../../../entity/session';
import type { CartPort } from '../public/CartPort';

export class ReadCart {
  constructor(private readonly gateway: Pick<CartPort, 'read'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal) {
    return this.gateway.read(session, signal);
  }
}
