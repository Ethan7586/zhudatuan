import { describe, expect, it } from 'vitest';
import { FULFILLMENT_CAPABILITIES, fulfillmentManifest } from '..';

describe('fulfillment module manifest', () => {
  it('keeps stable fulfillment identity and public entry', () => {
    expect(fulfillmentManifest.id).toBe('fulfillment');
    expect(fulfillmentManifest.provides).toEqual([FULFILLMENT_CAPABILITIES.read, FULFILLMENT_CAPABILITIES.manage]);
    expect(fulfillmentManifest.publicEntry).toBe('./index.ts');
  });

  it('declares fulfillment operations and module entrypoints', () => {
    expect(fulfillmentManifest.operations).toEqual([
      'fulfillment.tracking.read',
      'fulfillment.shipments.create',
      'fulfillment.returns.receive',
      'fulfillment.returns.inspect',
    ]);
    expect(fulfillmentManifest.entrypoints.http).toEqual(['fulfillmentOperations']);
    expect(fulfillmentManifest.entrypoints.jobs).toEqual(['fulfillment', 'tracking']);
  });
});
