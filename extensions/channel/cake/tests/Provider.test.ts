import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapCakeError } from '../ErrorMap';
import { CakeProvider } from '../Factory';
import { checkCakeHealth } from '../Health';
import { manifest } from '../Manifest';
import { CakeMapper } from '../Mapper';
import { CakeWebhook } from '../Webhook';
import { CakeOperations } from '../capability';

describe('cake provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('cake');
    expect(CakeProvider.definition.id).toBe('cake');
    expect(() => assertProviderCapabilities(CakeProvider.definition, CakeOperations)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('CAKE_MANIFEST_SIGNATURE_MISSING');
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({ factory: CakeProvider, manifest: manifest('signed'), mapper: new CakeMapper(), mapError: mapCakeError, webhook: CakeWebhook, health: () => checkCakeHealth({ health: async () => true }) });
  });
});
