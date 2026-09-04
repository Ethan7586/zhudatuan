import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { JdproductCapabilities, JdproductWebhook } from '../capability';
import { JdproductProvider } from '../Factory';
import { checkJdproductHealth, JdproductMapper, mapJdproductError } from '../integration';
import { manifest } from '../Manifest';

describe('jdproduct provider contract', () => {
  it('declares a signed and fully implemented required provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('jdproduct');
    expect(() => assertProviderCapabilities(JdproductProvider.definition, JdproductCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts', async () => {
    await assertProviderQuality({ factory: JdproductProvider, manifest: manifest('signed'), mapper: new JdproductMapper(), mapError: mapJdproductError, webhook: JdproductWebhook, health: () => checkJdproductHealth({ health: async () => true }) });
  });
});
