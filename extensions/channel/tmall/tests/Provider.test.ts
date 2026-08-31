import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { assertProviderCapabilities, assertProviderQuality } from '@shop/providercore';
import { mapTmallError } from '../ErrorMap';
import { TmallProvider } from '../Factory';
import { checkTmallHealth } from '../Health';
import { manifest } from '../Manifest';
import { TmallMapper } from '../Mapper';
import { TmallWebhook } from '../Webhook';
import { TmallOperations } from '../capability';

describe('tmall provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('tmall');
    expect(TmallProvider.definition.id).toBe('tmall');
    expect(() => assertProviderCapabilities(TmallProvider.definition, TmallOperations)).not.toThrow();
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('TMALL_MANIFEST_SIGNATURE_MISSING');
  });
  it('verifies mapping, failure, webhook, health, timeout, retry and circuit contracts', async () => {
    await assertProviderQuality({ factory: TmallProvider, manifest: manifest('signed'), mapper: new TmallMapper(), mapError: mapTmallError, webhook: TmallWebhook, health: () => checkTmallHealth({ health: async () => true }) });
  });
});
