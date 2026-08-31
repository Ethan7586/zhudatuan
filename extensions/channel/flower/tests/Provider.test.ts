import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapFlowerError } from '../ErrorMap';
import { FlowerProvider } from '../Factory';
import { checkFlowerHealth } from '../Health';
import { manifest } from '../Manifest';
import { FlowerMapper } from '../Mapper';
import { FlowerWebhook } from '../Webhook';
import { FlowerOperations } from '../capability';

describe('flower provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('flower');
    expect(FlowerProvider.definition.id).toBe('flower');
    expect(() => assertProviderCapabilities(FlowerProvider.definition, FlowerOperations)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('FLOWER_MANIFEST_SIGNATURE_MISSING');
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({ factory: FlowerProvider, manifest: manifest('signed'), mapper: new FlowerMapper(), mapError: mapFlowerError, webhook: FlowerWebhook, health: () => checkFlowerHealth({ health: async () => true }) });
  });
});
