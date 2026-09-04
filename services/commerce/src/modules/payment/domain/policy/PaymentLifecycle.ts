import type { ProviderPaymentState } from '@shop/contract';

export type { ProviderPaymentState } from '@shop/contract';
export type PaymentAction = 'settle' | 'requery' | 'close' | 'expire' | 'reset' | 'recover';

export class PaymentLifecycle {
  afterQuery(state: ProviderPaymentState, expired: boolean): PaymentAction {
    if (state === 'succeeded') return 'settle';
    if (state === 'refunded') return 'recover';
    if (state === 'pending') return expired ? 'close' : 'requery';
    if (state === 'closed' || expired) return 'expire';
    return 'reset';
  }

  afterClose(state: ProviderPaymentState): PaymentAction {
    if (state === 'succeeded') return 'settle';
    if (state === 'refunded') return 'recover';
    if (state === 'pending') return 'requery';
    return 'expire';
  }
}
