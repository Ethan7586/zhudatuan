import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapJdfreshError } from '../ErrorMap';
import { JdfreshProvider } from '../Factory';
import { checkJdfreshHealth } from '../Health';
import { manifest } from '../Manifest';
import { JdfreshMapper } from '../Mapper';
import { JdfreshWebhook } from '../Webhook';
import { JdfreshOperations } from '../capability';

describe('jdfresh provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('jdfresh');
    expect(JdfreshProvider.definition.id).toBe('jdfresh');
    expect(() => assertProviderCapabilities(JdfreshProvider.definition, JdfreshOperations)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('JDFRESH_MANIFEST_SIGNATURE_MISSING');
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({ factory: JdfreshProvider, manifest: manifest('signed'), mapper: new JdfreshMapper(), mapError: mapJdfreshError, webhook: JdfreshWebhook, health: () => checkJdfreshHealth({ health: async () => true }) });
  });
});
