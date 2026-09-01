import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface CartExperiencePort {
  active(context: ReadTransactionContext, scope: string): Promise<string | null>;
}
export const CART_EXPERIENCE_PORT = publicPort<CartExperiencePort>('experience', 'cart');
