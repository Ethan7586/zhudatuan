import { PROVIDER_API_VERSION,type ProviderManifest,type UnsignedProviderManifest } from '@shop/contract';
import { STANDARD_PROVIDER_LIMITS } from '@shop/providercore';

export const definition = Object.freeze({
  id: 'movie',
  kind: 'channel',
  priority: 1,
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'movie.v1',
  healthOperation: 'health',
  capabilities: ['Cinema', 'Show', 'SeatLock', 'Order', 'Issue', 'Cancel', 'Refund', 'Statement', 'Verify', 'Webhook'],
  permissions: ['channel.movie.operate'],
  configSchema: 'provider.movie.v1',
  eventSubscriptions: ['ProviderWebhookReceived'],
  secretRefs: ['credential'],
  limits: STANDARD_PROVIDER_LIMITS,
} as const satisfies UnsignedProviderManifest);

export function manifest(signature: string): ProviderManifest {
  if (!signature.trim()) throw new Error('MOVIE_MANIFEST_SIGNATURE_MISSING');
  return Object.freeze({ ...definition, signature });
}
