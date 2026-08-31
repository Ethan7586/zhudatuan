import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface CartWritePort {
  lockActive(database: OperationDatabase, cart: string, member: string, mall: string, expectedVersion: number): Promise<void>;
  convert(database: OperationDatabase, cart: string): Promise<void>;
}

export const CHECKOUT_CART_PORT = publicPort<CartWritePort>('cart', 'checkout');
