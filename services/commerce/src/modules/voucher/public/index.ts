import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { VoucherPort } from '../application/port/VoucherPort';
export type { VoucherChoice, VoucherRefund, VoucherTender } from '../application/port/VoucherPort';
export type CheckoutVoucherPort = Pick<VoucherPort, 'preview' | 'available' | 'reserve'>;
export type VerificationVoucherPort = Pick<VoucherPort, 'redeemableScope' | 'redeemVerification'>;
export type PaymentVoucherPort = Pick<VoucherPort, 'consume' | 'release' | 'refund'>;
export const CHECKOUT_VOUCHER_PORT = publicPort<CheckoutVoucherPort>('voucher', 'checkout');
export const VERIFICATION_VOUCHER_PORT = publicPort<VerificationVoucherPort>('voucher', 'verification');
export const PAYMENT_VOUCHER_PORT = publicPort<PaymentVoucherPort>('voucher', 'payment');
