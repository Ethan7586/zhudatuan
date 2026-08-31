import type { StorefrontSession } from '../../../shared/api/Session';
import { CheckoutGateway } from '../infrastructure/CheckoutGateway';
import { mapQuote } from '../infrastructure/CheckoutMapper';

export async function readCurrentQuote(session: StorefrontSession, signal?: AbortSignal) {
  const value = await CheckoutGateway.current(session, signal);
  return value.quote ? mapQuote(value.quote) : null;
}
