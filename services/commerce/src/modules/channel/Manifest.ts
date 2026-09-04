import { CAPABILITY_CODES_BY_OWNER } from '@shop/contract';
import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { EXTENSION_STATE_PORT, FINANCE_CHANNEL_PORT, FULFILLMENT_CHANNEL_PORT, PAYMENT_CHANNEL_PORT, PROVIDER_SYNC_PORT } from './public';

export const ChannelCapabilities = CAPABILITY_CODES_BY_OWNER.channel;

export const Manifest = defineModuleManifest({
  id: 'channel',
  dependencies: ['extension', 'organization', 'capability'],
  services: ['kms.client'],
  ports: [FINANCE_CHANNEL_PORT],
  workloads: {
    jobs: { ports: [FINANCE_CHANNEL_PORT, PAYMENT_CHANNEL_PORT] },
    provider: {
      dependencies: ['catalog', 'finance', 'inventory', 'pricing'],
      bindings: ['catalog', 'finance', 'inventory', 'pricing'],
      services: ['database.pool', 'extension.registry', 'secret.store', 'kms.client'],
      ports: [PROVIDER_SYNC_PORT, EXTENSION_STATE_PORT, FULFILLMENT_CHANNEL_PORT],
    },
  },
  capabilities: ChannelCapabilities,
});
