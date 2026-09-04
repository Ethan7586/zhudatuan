import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { manifestPayload, PROVIDER_API_VERSION, type ProviderManifest } from '@shop/contract';
import { Manifest } from './Manifest';

const value: ProviderManifest = {
  id: 'sample',
  name: '示例渠道',
  kind: 'channel',
  version: '1.2.3',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'sample.v1',
  dependencies: [],
  healthOperation: 'health',
  capabilities: ['Catalog'],
  permissions: ['sample.read'],
  configSchema: 'sample.v1',
  eventSubscriptions: [],
  secretRefs: ['credential'],
  sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.sample.sandboxurl' },
  rateLimits: { maxConcurrency: 2, requestsPerSecond: 5 },
  timeout: { connectionMs: 100, responseMs: 200, totalMs: 300 },
  retryPolicy: { maxAttempts: 2 },
  circuitPolicy: { failureThreshold: 3, recoveryMs: 1000 },
  webhookContract: 'provider.sample.webhook.v1',
  signature: 'c2lnbmVk',
};

describe('Manifest', () => {
  it('parses the complete signed contract and hashes its canonical unsigned payload', () => {
    const manifest = Manifest.parse(value, 'sample');
    expect(manifest.hash).toBe(createHash('sha256').update(manifestPayload(value)).digest('hex'));
    expect(manifest.value.healthOperation).toBe('health');
    const reordered = Object.fromEntries(Object.entries(value).reverse());
    expect(Manifest.parse(reordered, 'sample').hash).toBe(manifest.hash);
  });
  it('rejects duplicate capabilities and unsafe limits', () => {
    expect(() => Manifest.parse({ ...value, capabilities: ['Catalog', 'Catalog'] })).toThrow('PROVIDER_MANIFEST_CAPABILITY_INVALID');
    expect(() => Manifest.parse({ ...value, rateLimits: { ...value.rateLimits, maxConcurrency: 65 } })).toThrow('PROVIDER_CONCURRENCY_INVALID');
  });
  it('requires immutable dependency, capability and permission metadata', () => {
    const manifest = Manifest.parse({ ...value, dependencies: [{ id: 'support', version: '1.0.0', capabilities: ['Catalog'] }] });
    expect(Object.isFrozen(manifest.value.dependencies)).toBe(true);
    expect(Object.isFrozen(manifest.value.dependencies[0]?.capabilities)).toBe(true);
    expect(() => Manifest.parse({ ...value, dependencies: undefined })).toThrow('PROVIDER_MANIFEST_DEPENDENCY_INVALID');
    expect(() => Manifest.parse({ ...value, permissions: [] })).toThrow('PROVIDER_MANIFEST_PERMISSION_INVALID');
  });
  it('rejects a sandbox contract that could silently reach an undeclared endpoint', () => {
    expect(() => Manifest.parse({ ...value, sandbox: { supported: true, mode: 'endpoint', endpointRef: null } })).toThrow('PROVIDER_SANDBOX_INVALID');
  });
  it('rejects priority copied from the workbook catalog', () => {
    expect(() => Manifest.parse({ ...value, priority: 1 })).toThrow('PROVIDER_MANIFEST_FIELDS_INVALID');
  });
});
