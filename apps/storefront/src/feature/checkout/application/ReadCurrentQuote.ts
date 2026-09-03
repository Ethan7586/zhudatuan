import type { StorefrontSession } from '../../../entity/session';
import { CheckoutGateway } from '../infrastructure/CheckoutGateway';
import { mapQuote } from '../infrastructure/CheckoutMapper';

export class ReadCurrentQuote {
  constructor(private readonly gateway: Pick<CheckoutGateway, 'current'>) {}
  async execute(session: StorefrontSession, signal?: AbortSignal) {
    const value = await this.gateway.current(session, signal);
    return value.quote ? mapQuote(value.quote) : null;
  }
}
