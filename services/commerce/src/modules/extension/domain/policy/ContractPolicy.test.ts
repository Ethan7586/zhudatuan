import { describe, expect, it } from 'vitest';
import { PROVIDER_API_VERSION, type ProviderManifest } from '@shop/contract';
import { ContractPolicy } from './ContractPolicy';

const signed: ProviderManifest = {
  id: 'sample',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'sample.v1',
  healthOperation: 'health',
  capabilities: ['Catalog'],
  permissions: ['channel.sample.operate'],
  configSchema: 'provider.sample.v1',
  eventSubscriptions: [],
  secretRefs: ['credential'],
  rateLimits: { maxConcurrency: 1, requestsPerSecond: 1 },
  timeout: { connectionMs: 1, responseMs: 1, totalMs: 1 },
  retryPolicy: { maxAttempts: 1 },
  circuitPolicy: { failureThreshold: 1, recoveryMs: 100 },
  webhookContract: 'provider.sample.webhook.v1',
  signature: 'signed',
};

describe('ContractPolicy', () => {
  it('requires an exact host definition', () => expect(() => new ContractPolicy().assert(signed, { ...signed, signature: undefined } as never)).not.toThrow());
  it('rejects any contract drift', () => expect(() => new ContractPolicy().assert({ ...signed, contractVersion: 'sample.v0' }, { ...signed, signature: undefined } as never)).toThrow('EXTENSION_CONTRACT_MISMATCH'));
});
