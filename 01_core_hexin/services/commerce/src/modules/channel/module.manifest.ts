import { defineModuleManifest } from '@shop/kernel';
import { CHANNEL_CAPABILITIES } from './01_public_gongkai/ChannelCapabilities';

export const channelManifest = defineModuleManifest({
  id: 'channel',
  version: '1.0.0',
  kind: 'business',
  provides: [CHANNEL_CAPABILITIES.read, CHANNEL_CAPABILITIES.manage],
  requires: ['extension', 'catalog', 'inventory', 'fulfillment', 'finance'],
  operations: [
    'channel.distributors.create',
    'channel.distributors.read',
    'channel.distributors.update',
    'channel.distributors.disable',
    'channel.bindings.manage',
    'channel.quotas.manage',
    'channel.connections.read',
    'channel.connections.create',
    'channel.connections.update',
    'channel.connections.test',
    'channel.connections.enable',
    'channel.connections.disable',
    'channel.webhooks.receive',
    'channel.syncruns.start',
    'channel.syncruns.read',
    'channel.syncruns.cancel',
    'channel.operations.read',
    'channel.operations.replay',
  ],
  publishes: [
    'channel.sync.completed',
    'channel.webhook.applied',
    'channel.refund.changed',
  ],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['channelRoutes', 'channelOperatorReadOperations'],
    jobs: ['catalogsync', 'pricesync', 'inventorysync', 'statementsync', 'channelwebhook'],
  },
});
