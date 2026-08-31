import type { StorefrontSession } from '../../../shared/api/Session';
import { CartGateway } from '../infrastructure/CartGateway';

export function readCart(session: StorefrontSession, signal?: AbortSignal) {
  return CartGateway.read(session, signal);
}
