import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface CartWritePort {
  lockActive(context: WriteTransactionContext, cart: string, member: string, mall: string, expectedVersion: number): Promise<void>;
  convert(context: WriteTransactionContext, cart: string): Promise<void>;
}

export const CHECKOUT_CART_PORT = publicPort<CartWritePort>('cart', 'checkout');
