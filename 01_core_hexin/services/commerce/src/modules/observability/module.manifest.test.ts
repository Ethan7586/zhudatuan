import { describe, expect, it } from 'vitest';
import { ObservabilityModule, observabilityManifest } from '.';

describe('observability module manifest', () => {
  it('identifies the platform telemetry entrypoint', () => {
    expect(observabilityManifest).toMatchObject({
      id: 'observability',
      kind: 'platform',
      publicEntry: './index.ts',
      requires: [],
      operations: [
        'observability.clienterrors.create',
        'observability.clienterrors.read',
      ],
    });
    expect(ObservabilityModule.id).toBe(observabilityManifest.id);
  });
});
