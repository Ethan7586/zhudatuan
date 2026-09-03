import type { StorefrontSession } from '../../../entity/session';
import { CartGateway } from '../infrastructure/CartGateway';

export class ReadCart {
  constructor(private readonly gateway: Pick<CartGateway, 'read'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal) { return this.gateway.read(session, signal); }
}
