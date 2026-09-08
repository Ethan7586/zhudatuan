import { publicPort } from '../../../composition/ModuleRegistry';
import type { CheckoutVoucherPort, VerificationVoucherPort } from './VoucherReadPort';
import type { CheckoutVoucherTenderPort, FulfillmentVoucherPort, PaymentVoucherPort } from './VoucherTenderPort';

export type { CheckoutVoucherPort, VerificationVoucherPort, VoucherChoice } from './VoucherReadPort';
export type { CheckoutVoucherTenderPort, FulfillmentVoucherItem, FulfillmentVoucherPort, FulfillmentVoucherReceipt, PaymentVoucherPort, VoucherRefund, VoucherTender } from './VoucherTenderPort';

export interface CheckoutVoucherGateway extends CheckoutVoucherPort, CheckoutVoucherTenderPort {}

export const CHECKOUT_VOUCHER_PORT = publicPort<CheckoutVoucherGateway>('voucher', 'checkout');
export const VERIFICATION_VOUCHER_PORT = publicPort<VerificationVoucherPort>('voucher', 'verification');
export const PAYMENT_VOUCHER_PORT = publicPort<PaymentVoucherPort>('voucher', 'payment');
export const FULFILLMENT_VOUCHER_PORT = publicPort<FulfillmentVoucherPort>('voucher', 'fulfillment');
