import { publicPort } from '../../../bootstrap/ModuleRegistry';
export type { MarketingReservation } from '../MarketingPort';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
export interface CheckoutMarketingPort {
  campaigns(database: OperationDatabase, scope: string): Promise<readonly CheckoutCampaign[]>;
  reserve(database: OperationDatabase, input: import('../MarketingPort').MarketingReservation): Promise<void>;
}
export interface CheckoutCampaign {
  readonly id: string;
  readonly version: number;
  readonly rule: Record<string, unknown>;
  readonly remainingBudget: number;
}
export interface PaymentMarketingPort {
  commit(database: OperationDatabase, order: string): Promise<void>;
  release(database: OperationDatabase, order: string): Promise<void>;
}
export interface ExperienceMarketingPort {
  references(database: OperationDatabase, campaigns: readonly string[]): Promise<boolean>;
}
export const CHECKOUT_MARKETING_PORT = publicPort<CheckoutMarketingPort>('marketing', 'checkout');
export const PAYMENT_MARKETING_PORT = publicPort<PaymentMarketingPort>('marketing', 'payment');
export const EXPERIENCE_MARKETING_PORT = publicPort<ExperienceMarketingPort>('marketing', 'experience');
