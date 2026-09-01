import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface PaymentWebhookOrderPort {
  resolveScope(order: string, signal: AbortSignal, deadline: number): Promise<string | null>;
}

export const PAYMENT_WEBHOOK_ORDER_PORT = publicPort<PaymentWebhookOrderPort>('order', 'paymentwebhook');
