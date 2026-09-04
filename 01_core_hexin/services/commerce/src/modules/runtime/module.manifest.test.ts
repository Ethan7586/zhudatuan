import { describe, expect, it } from 'vitest';
import {
  IdentityRegistrationRuntimeModule,
  MallProvisioningRuntimeModule,
  PurchaseRuntimeModule,
  RuntimeModule,
  WebBusinessRuntimeModule,
  runtimeManifest,
} from '.';

describe('runtime module manifest', () => {
  it('identifies the shared platform host and its public variants', () => {
    expect(runtimeManifest).toMatchObject({
      id: 'runtime',
      kind: 'platform',
      publicEntry: './index.ts',
      requires: ['checkout.manage', 'identity.manage', 'pricing.manage'],
      operations: [
        'runtime.health.live',
        'runtime.health.ready',
        'runtime.health.startup',
        'runtime.health.dependency',
      ],
    });
    expect([
      RuntimeModule,
      IdentityRegistrationRuntimeModule,
      MallProvisioningRuntimeModule,
      PurchaseRuntimeModule,
      WebBusinessRuntimeModule,
    ].map(({ id }) => id)).toEqual(Array(5).fill(runtimeManifest.id));
  });
});
