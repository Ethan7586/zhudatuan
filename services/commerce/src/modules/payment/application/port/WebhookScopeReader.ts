import type { VerifiedPaymentWebhook } from './WebhookInboxRepository';

export interface WebhookScopeReader {
  resolve(notification: VerifiedPaymentWebhook, signal: AbortSignal, deadline: number): Promise<string>;
}
