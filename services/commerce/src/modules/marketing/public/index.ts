import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
export type { MarketingReservation } from './MarketingReservation';

export interface CheckoutMarketingPort {
  campaigns(context: ReadTransactionContext, scope: string): Promise<readonly CheckoutCampaign[]>;
  reserve(context: WriteTransactionContext, input: import('./MarketingReservation').MarketingReservation): Promise<void>;
}
export interface CheckoutCampaign {
  readonly id: string;
  readonly version: number;
  readonly rule: Record<string, unknown>;
  readonly remainingBudget: number;
}
export interface PaymentMarketingPort {
  commit(context: WriteTransactionContext, order: string): Promise<void>;
  release(context: WriteTransactionContext, order: string): Promise<void>;
}
export interface ExperienceMarketingPort {
  references(context: ReadTransactionContext, campaigns: readonly string[]): Promise<boolean>;
}
export const CHECKOUT_MARKETING_PORT = publicPort<CheckoutMarketingPort>('marketing', 'checkout');
export const PAYMENT_MARKETING_PORT = publicPort<PaymentMarketingPort>('marketing', 'payment');
export const EXPERIENCE_MARKETING_PORT = publicPort<ExperienceMarketingPort>('marketing', 'experience');
