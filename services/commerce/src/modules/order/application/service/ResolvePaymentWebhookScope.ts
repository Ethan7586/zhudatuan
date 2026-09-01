import type { PaymentWebhookOrderPort } from '../../public/PaymentWebhookOrderPort';
import type { PaymentWebhookScopeReader } from '../port/PaymentWebhookScopeReader';

export class ResolvePaymentWebhookScope implements PaymentWebhookOrderPort {
  constructor(private readonly scopes: PaymentWebhookScopeReader) {}

  resolveScope(order: string, signal: AbortSignal, deadline: number): Promise<string | null> {
    return this.scopes.resolve(order, signal, deadline);
  }
}
