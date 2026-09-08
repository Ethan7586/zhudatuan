import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface CartExperiencePort {
  active(context: ReadTransactionContext, scope: string): Promise<string | null>;
}
export const CART_EXPERIENCE_PORT = publicPort<CartExperiencePort>('experience', 'cart');
