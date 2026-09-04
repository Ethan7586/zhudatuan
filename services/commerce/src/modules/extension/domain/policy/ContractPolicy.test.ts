import { describe, expect, it } from 'vitest';
import { PROVIDER_API_VERSION, type ProviderManifest } from '@shop/contract';
import { ContractPolicy } from './ContractPolicy';

const signed: ProviderManifest = {
  id: 'sample',
  name: '示例渠道',
  kind: 'channel',
  version: '1.0.0',
  apiVersion: PROVIDER_API_VERSION,
  contractVersion: 'sample.v1',
  dependencies: [],
  healthOperation: 'health',
  capabilities: ['Catalog'],
  permissions: ['channel.sample.operate'],
  configSchema: 'provider.sample.v1',
  eventSubscriptions: [],
  secretRefs: ['credential'],
  sandbox: { supported: true, mode: 'endpoint', endpointRef: 'provider.sample.sandboxurl' },
  rateLimits: { maxConcurrency: 1, requestsPerSecond: 1 },
  timeout: { connectionMs: 1, responseMs: 1, totalMs: 1 },
  retryPolicy: { maxAttempts: 1 },
  circuitPolicy: { failureThreshold: 1, recoveryMs: 100 },
  webhookContract: 'provider.sample.webhook.v1',
  signature: 'signed',
};

describe('ContractPolicy', () => {
  it('requires an exact host definition', () => expect(() => new ContractPolicy().assert(signed, { ...signed, signature: undefined } as never)).not.toThrow());
  it('requires the exact host API and rejects duplicate capability declarations', () => {
    const policy = new ContractPolicy();
    const incompatible = { ...signed, apiVersion: '2026-08-20' };
    expect(() => policy.assert(incompatible, { ...incompatible, signature: undefined } as never)).toThrow('EXTENSION_API_VERSION_MISMATCH');
    const duplicate = { ...signed, capabilities: ['Catalog', 'Catalog'] } as ProviderManifest;
    expect(() => policy.assert(duplicate, { ...duplicate, signature: undefined } as never)).toThrow('EXTENSION_CAPABILITY_DUPLICATE');
  });
  it('rejects any contract drift', () => expect(() => new ContractPolicy().assert({ ...signed, contractVersion: 'sample.v0' }, { ...signed, signature: undefined } as never)).toThrow('EXTENSION_CONTRACT_MISMATCH'));
  it('binds configuration schema identity to provider contract version', () => {
    const invalid = { ...signed, configSchema: 'provider.other.v1' };
    expect(() => new ContractPolicy().assert(invalid, { ...invalid, signature: undefined } as never)).toThrow('EXTENSION_CONFIGURATION_SCHEMA_MISMATCH');
  });
  it('uses manifest sandbox and SecretRef declarations without provider special cases', () => {
    const policy = new ContractPolicy();
    const remote = { baseUrl: 'https://provider.example', endpoints: { health: '/health' }, secretRef: 'vault/channel/credential', healthOperation: 'health' };
    expect(() => policy.assertConfiguration(signed, remote)).not.toThrow();
    expect(() => policy.assertConfiguration(signed, { ...remote, secretRef: undefined }, true)).not.toThrow();
    expect(() => policy.assertConfiguration(signed, { ...remote, secretRef: undefined })).toThrow('PROVIDER_CONNECTION_CONFIGURATION_INVALID');
    const local = { ...signed, id: 'local', contractVersion: 'local.v1', configSchema: 'provider.local.v1', secretRefs: [], healthOperation: 'local', sandbox: { supported: true, mode: 'local', endpointRef: null } } as ProviderManifest;
    expect(() => policy.assertConfiguration(local, { baseUrl: null, endpoints: {}, secretRef: null, healthOperation: 'local' })).not.toThrow();
    expect(() => policy.assertConfiguration(local, { baseUrl: 'https://provider.example', endpoints: {}, secretRef: null, healthOperation: 'local' })).toThrow('PROVIDER_LOCAL_CONFIGURATION_INVALID');
  });
  it('rejects missing, inline or structurally unsafe configuration', () => {
    const policy = new ContractPolicy();
    const valid = { baseUrl: 'https://provider.example', endpoints: { health: '/health' }, secretRef: 'vault/channel/credential', healthOperation: 'health' };
    expect(() => policy.assertConfiguration(signed, { ...valid, endpoints: {} })).toThrow('PROVIDER_CONNECTION_CONFIGURATION_INVALID');
    expect(() => policy.assertConfiguration(signed, { ...valid, baseUrl: 'https://user:secret@provider.example' })).toThrow('PROVIDER_CONNECTION_CONFIGURATION_INVALID');
    expect(() => policy.assertConfiguration(signed, { ...valid, endpoints: { health: 'https://evil.example' } })).toThrow('PROVIDER_CONNECTION_CONFIGURATION_INVALID');
  });
  it('allows only the provider-scoped minimum permission', () => {
    const policy = new ContractPolicy();
    const broad = { ...signed, permissions: ['channel.*'] };
    expect(() => policy.assert(broad, { ...broad, signature: undefined } as never)).toThrow('EXTENSION_PERMISSION_NOT_MINIMAL');
    const foreign = { ...signed, permissions: ['channel.other.operate'] };
    expect(() => policy.assert(foreign, { ...foreign, signature: undefined } as never)).toThrow('EXTENSION_PERMISSION_NOT_MINIMAL');
  });
  it('requires an exact, capability-satisfying and acyclic dependency graph', () => {
    const policy = new ContractPolicy();
    const support = provider('support', [], ['Catalog', 'Price']);
    const root = { ...signed, dependencies: [{ id: 'support', version: '1.0.0', capabilities: ['Price'] }] } as ProviderManifest;
    expect(() => policy.assertDependencies(root, [support])).not.toThrow();
    expect(() => policy.assertDependencies(root, [])).toThrow('EXTENSION_DEPENDENCY_MISSING:support@1.0.0');
    expect(() => policy.assertDependencies(root, [{ ...support, version: '2.0.0' }])).toThrow('EXTENSION_DEPENDENCY_VERSION_MISMATCH:support@1.0.0:2.0.0');
    expect(() => policy.assertDependencies(root, [{ ...support, capabilities: ['Catalog'] }])).toThrow('EXTENSION_DEPENDENCY_CAPABILITY_MISMATCH:support@1.0.0:Price');
    const cycle = { ...support, dependencies: [{ id: 'sample', version: '1.0.0', capabilities: ['Catalog'] }] } as ProviderManifest;
    expect(() => policy.assertDependencies(root, [cycle])).toThrow('EXTENSION_DEPENDENCY_CYCLE:sample@1.0.0');
  });
});

function provider(id: string, dependencies: ProviderManifest['dependencies'], capabilities: ProviderManifest['capabilities']): ProviderManifest {
  return {
    ...signed,
    id,
    name: id,
    contractVersion: `${id}.v1`,
    configSchema: `provider.${id}.v1`,
    permissions: [`channel.${id}.operate`],
    dependencies,
    capabilities,
  };
}
