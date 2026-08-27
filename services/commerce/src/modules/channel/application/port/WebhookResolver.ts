import type { ProviderWebhookVerifier } from '@shop/contract';

export interface WebhookResolver {
  resolve(provider: string, scope: string): ProviderWebhookVerifier;
}
