import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore/test';
import { JdfreshCapabilities, JdfreshWebhook } from '../capability';
import { JdfreshProvider } from '../Factory';
import { checkJdfreshHealth, JdfreshMapper, mapJdfreshError } from '../integration';
import { manifest } from '../Manifest';

describe('jdfresh provider contract', () => {
  it('declares a signed and fully implemented required provider', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('jdfresh');
    expect(() => assertProviderCapabilities(JdfreshProvider.definition, JdfreshCapabilities)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
  });
  it('passes shared quality contracts', async () => {
    await assertProviderQuality({ factory: JdfreshProvider, manifest: manifest('signed'), mapper: new JdfreshMapper(), mapError: mapJdfreshError, webhook: JdfreshWebhook, health: () => checkJdfreshHealth({ health: async () => true }) });
  });
});
