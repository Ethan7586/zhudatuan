import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapSupplierError } from '../ErrorMap';
import { SupplierProvider } from '../Factory';
import { checkSupplierHealth } from '../Health';
import { manifest } from '../Manifest';
import { SupplierMapper } from '../Mapper';
import { SupplierWebhook } from '../Webhook';

describe('supplier provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('supplier');
    expect(SupplierProvider.definition.id).toBe('supplier');
    expect(() => assertProviderCapabilities(SupplierProvider.definition, 'local')).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('SUPPLIER_MANIFEST_SIGNATURE_MISSING');
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({
      factory: SupplierProvider,
      manifest: manifest('signed'),
      mapper: new SupplierMapper(),
      mapError: mapSupplierError,
      webhook: SupplierWebhook,
      health: () => checkSupplierHealth({ health: async () => true }),
    });
  });
});
