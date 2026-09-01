import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapChargeError } from '../ErrorMap';
import { ChargeProvider } from '../Factory';
import { checkChargeHealth } from '../Health';
import { manifest } from '../Manifest';
import { ChargeMapper } from '../Mapper';
import { ChargeWebhook } from '../Webhook';
import { ChargeCapabilities } from '../capability';

describe('charge provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('charge');
    expect(ChargeProvider.definition.id).toBe('charge');
    expect(() => assertProviderCapabilities(ChargeProvider.definition, ChargeCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('CHARGE_MANIFEST_SIGNATURE_MISSING');
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({ factory: ChargeProvider, manifest: manifest('signed'), mapper: new ChargeMapper(), mapError: mapChargeError, webhook: ChargeWebhook, health: () => checkChargeHealth({ health: async () => true }) });
  });
});
