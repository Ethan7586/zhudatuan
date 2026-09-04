import type { StorefrontSession } from '../../../entity/session';
import type { CartSnapshot } from '../model/CartSnapshot';

export interface CartChange {
  readonly listingId: string;
  readonly quantity: number;
  readonly lineVersion: number | null;
  readonly cartVersion: number;
  readonly idempotencyKey: string;
}

export interface CartPort {
  read(session: StorefrontSession, signal?: AbortSignal): Promise<CartSnapshot>;
  put(session: StorefrontSession, input: CartChange): Promise<void>;
}
