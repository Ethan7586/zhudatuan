import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapJdproductError } from '../ErrorMap';
import { JdproductProvider } from '../Factory';
import { checkJdproductHealth } from '../Health';
import { manifest } from '../Manifest';
import { JdproductMapper } from '../Mapper';
import { JdproductWebhook } from '../Webhook';
import { JdproductCapabilities } from '../capability';

describe('jdproduct provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('jdproduct');
    expect(JdproductProvider.definition.id).toBe('jdproduct');
    expect(() => assertProviderCapabilities(JdproductProvider.definition, JdproductCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('JDPRODUCT_MANIFEST_SIGNATURE_MISSING');
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({
      factory: JdproductProvider,
      manifest: manifest('signed'),
      mapper: new JdproductMapper(),
      mapError: mapJdproductError,
      webhook: JdproductWebhook,
      health: () => checkJdproductHealth({ health: async () => true }),
    });
  });
});
