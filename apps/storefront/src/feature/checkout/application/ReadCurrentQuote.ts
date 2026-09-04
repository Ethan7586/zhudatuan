import type { StorefrontSession } from '../../../entity/session';
import type { CheckoutPort } from '../public/CheckoutPort';

export class ReadCurrentQuote {
  constructor(private readonly gateway: Pick<CheckoutPort, 'current'>) {}
  async execute(session: StorefrontSession, signal?: AbortSignal) {
    return this.gateway.current(session, signal);
  }
}
