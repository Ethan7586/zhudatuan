import { describe, expect, it } from 'vitest';
import { providerFixtureResult } from './ProviderFixture';

const providers = new Set(['jdproduct', 'supplier']);

describe('local provider fixture', () => {
  it('requires a known provider and idempotency key', () => {
    expect(providerFixtureResult('POST', '/v1/providers/jdproduct/catalog', {}, providers)).toMatchObject({ status: 400 });
    expect(providerFixtureResult('POST', '/v1/providers/unknown/catalog', { 'x-idempotency-key': 'one' }, providers)).toMatchObject({ status: 404 });
  });

  it.each([['throttled', 429], ['unavailable', 503], ['rejected', 422], ['accepted', 200]] as const)('returns deterministic %s behavior', (behavior, status) => {
    expect(providerFixtureResult('POST', '/v1/providers/jdproduct/catalog', { 'x-idempotency-key': 'one', 'x-provider-fixture-result': behavior }, providers).status).toBe(status);
  });
});
