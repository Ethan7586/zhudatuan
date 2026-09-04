import { PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_POLICY } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'movie',
  name: '电影',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'movie.v1',
  dependencies: [],
  healthOperation: 'health',
  capabilities: ['Cinema', 'Show', 'SeatLock', 'Order', 'Issue', 'Cancel', 'Refund', 'Statement', 'Verify', 'Webhook'],
  permissions: ['channel.movie.operate'],
  configSchema: 'provider.movie.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.movie.sandboxurl' },
  ...STANDARD_PROVIDER_POLICY,
  webhookContract: 'provider.movie.webhook.v1',
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('MOVIE_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
