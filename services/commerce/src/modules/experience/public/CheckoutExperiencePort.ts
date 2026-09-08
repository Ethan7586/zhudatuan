import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface CheckoutExperienceRelease {
  readonly version: string;
  readonly hash: string;
}
export interface CheckoutExperiencePort {
  published(context: ReadTransactionContext, application: string): Promise<CheckoutExperienceRelease | null>;
}
export const CHECKOUT_EXPERIENCE_PORT = publicPort<CheckoutExperiencePort>('experience', 'checkout');
