import type { ExtensionRegistry } from '../../../../bootstrap/ExtensionRegistry';
import type { WebhookResolver } from '../../application/port/WebhookResolver';

export class ExtensionWebhookResolver implements WebhookResolver {
  constructor(private readonly registry: ExtensionRegistry) {}
  resolve(provider: string, scope: string) {
    return this.registry.require(provider, scope, 'Webhook', 'webhook');
  }
}
