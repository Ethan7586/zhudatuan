import { token } from '../../../../bootstrap/Container';
import type { PaymentGateway } from '@shop/contract';

export type {
  PaymentApplication,
  PaymentGateway,
  PaymentGatewayCapability,
  PaymentGatewayManifest,
  PaymentNotification,
  PaymentPrepayInput as PrepayInput,
} from '@shop/contract';

export const PAYMENT_GATEWAY = token<PaymentGateway>('payment.gateway');
