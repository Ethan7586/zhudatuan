import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface CheckoutExperienceRelease {
  readonly version: string;
  readonly hash: string;
}
export interface CheckoutExperiencePort {
  published(context: ReadTransactionContext, application: string): Promise<CheckoutExperienceRelease | null>;
}
export const CHECKOUT_EXPERIENCE_PORT = publicPort<CheckoutExperiencePort>('experience', 'checkout');
