import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { Webhook } from '@shop/providercore';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { SupplierProvider } from '../Factory';
import { checkSupplierHealth, mapSupplierError, SupplierMapper } from '../integration';
import { manifest } from '../Manifest';

describe('supplier provider contract', () => {
  it('declares a signed and fully implemented local provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('supplier');
    expect(() => assertProviderCapabilities(SupplierProvider.definition, 'local')).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts without claiming a webhook capability', async () => {
    await assertProviderQuality({ factory: SupplierProvider, manifest: manifest('signed'), mapper: new SupplierMapper(), mapError: mapSupplierError, webhook: Webhook, health: () => checkSupplierHealth({ health: async () => true, circuitState: () => 'closed' }) });
  });
});
