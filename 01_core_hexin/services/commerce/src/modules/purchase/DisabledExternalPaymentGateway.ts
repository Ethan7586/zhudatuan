import { createHash } from 'node:crypto';
import type { WechatScene } from '@shop/config/server';
import type {
  PaymentApplication,
  PaymentGateway,
  PaymentNotification,
  PrepayInput,
} from '../payment_zhifu';

export class DisabledExternalPaymentGateway implements PaymentGateway {
  application(scene: WechatScene): PaymentApplication {
    return Object.freeze({
      scene,
      applicationHash: createHash('sha256').update(`purchase-only:${scene}`).digest('hex'),
    });
  }

  prepay(_input: PrepayInput): Promise<Readonly<Record<string, string>>> { return rejected(); }
  query(_orderNumber: string, _application: PaymentApplication): Promise<never> { return rejected(); }
  close(_orderNumber: string, _application: PaymentApplication): Promise<void> { return rejected(); }
  refund(_input: Readonly<{ refundNumber: string; transaction: string; refundMinor: number; totalMinor: number; reason: string }>): Promise<never> {
    return rejected();
  }
  queryRefund(_refundNumber: string): Promise<never> { return rejected(); }
  verifyNotification(_headers: Readonly<Record<string, string>>, _body: string): Promise<PaymentNotification> { return rejected(); }
}

function rejected<T>(): Promise<T> {
  return Promise.reject(new Error('EXTERNAL_PAYMENT_DISABLED'));
}
