import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { BenefitGateway } from '../application/port/BenefitPort';
export type { BenefitGateway, BenefitChoice, BenefitRefund, BenefitTender } from '../application/port/BenefitPort';
export type CheckoutBenefitPort = Pick<BenefitGateway, 'preview' | 'available' | 'reserve'>;
export type PaymentBenefitPort = Pick<BenefitGateway, 'consume' | 'release' | 'refund'>;
export const CHECKOUT_BENEFIT_PORT = publicPort<CheckoutBenefitPort>('benefit', 'checkout');
export const PAYMENT_BENEFIT_PORT = publicPort<PaymentBenefitPort>('benefit', 'payment');
export { BENEFIT_READ_PORT, PgBenefitReadPort, type BenefitReadPort, type BenefitSummary } from './BenefitReadPort';
export { SUPPORT_BENEFIT_PORT, PgSupportBenefitPort, type SupportBenefitPort } from './SupportBenefitPort';
