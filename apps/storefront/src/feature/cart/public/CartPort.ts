import type { StorefrontSession } from '../../../entity/session';
import type { CartSnapshot } from '../model/CartSnapshot';

export interface CartAccess {
  readonly session: StorefrontSession | null;
  readonly csrfToken: string | null;
}

export interface CartChange {
  readonly listingId: string;
  readonly quantity: number;
  readonly selected?: boolean;
  readonly lineVersion: number | null;
  readonly cartVersion: number;
  readonly idempotencyKey: string;
}

export interface CartPort {
  read(access: CartAccess, signal?: AbortSignal): Promise<CartSnapshot>;
  put(access: CartAccess, input: CartChange): Promise<void>;
  batch(access: CartAccess, input: Readonly<{ cartVersion: number; idempotencyKey: string; items: readonly Omit<CartChange, 'cartVersion' | 'idempotencyKey'>[] }>): Promise<CartSnapshot>;
}
