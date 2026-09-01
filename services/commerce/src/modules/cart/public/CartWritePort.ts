import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface CartWritePort {
  lockActive(context: WriteTransactionContext, cart: string, member: string, mall: string, expectedVersion: number): Promise<void>;
  convert(context: WriteTransactionContext, cart: string): Promise<void>;
}

export const CHECKOUT_CART_PORT = publicPort<CartWritePort>('cart', 'checkout');
