import { COMMERCE_OPERATIONS } from '@shop/contract';
import { describe, expect, it } from 'vitest';

const STEPUP_OPERATIONS = ['identity.stepup.start', 'identity.stepup.complete', 'identity.stepup.disable'] as const;

describe('Step-up contract', () => {
  it.each(STEPUP_OPERATIONS)('%s is a same-origin, CSRF-protected and idempotent session command', (id) => {
    const operation = COMMERCE_OPERATIONS.find((candidate) => candidate.id === id);

    expect(operation).toMatchObject({
      id,
      module: 'identity',
      audience: 'public',
      assuranceLevel: 'session',
      originPolicy: 'sameorigin',
      csrfPolicy: 'required',
      targetPolicy: 'exact',
      idempotencyPolicy: 'required',
      idempotencyScope: 'actor-operation-scope',
      concurrencyPolicy: 'serialized',
      lifecycle: 'active',
    });
    expect(operation?.targets).toEqual(['console', 'storefront', 'miniapp', 'store', 'supplier']);
    expect(operation?.requirements.length).toBeGreaterThan(0);
    if (id !== 'identity.stepup.disable') expect(operation?.requirements).toContain('MVPIDENTITY');
  });
});
