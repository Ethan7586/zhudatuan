import { describe, expect, it } from 'vitest';
import { Package } from './Package';
import { Shipment } from './Shipment';
import { TrackingEvent } from './TrackingEvent';
import { FulfillmentOrder } from './FulfillmentOrder';
import { Return } from './Return';
import { FulfillmentPolicy } from '../policy/FulfillmentPolicy';
import { FulfillmentFailurePolicy } from '../policy/FulfillmentFailurePolicy';

describe('fulfillment aggregates', () => {
  it('retries transient provider failures and immediately escalates permanent evidence errors', () => {
    const policy = new FulfillmentFailurePolicy();
    expect(policy.classify(new Error('PROVIDER_TIMEOUT'), 1)).toBe('retry');
    expect(policy.classify(new Error('PROVIDER_RESPONSE_INVALID'), 1)).toBe('needsaction');
    expect(policy.classify(new Error('PROVIDER_TIMEOUT'), 5)).toBe('needsaction');
  });
  it('routes internal physical work to acceptance and digital work to completion', () => {
    const source = { id: 'fulfillment:one', order: 'order:one', kind: 'shipment' as const, state: 'pending' as const, lines: [{ line: 'line:one', quantity: 1 }], version: 0 };
    expect(FulfillmentOrder.load({ ...source, route: 'physical' }).internalAccepted()).toBe('accepted');
    expect(FulfillmentOrder.load({ ...source, route: 'digital', kind: 'digital' }).internalAccepted()).toBe('completed');
  });
  it('supports split packages while preserving line quantity', () => {
    const shipment = Shipment.create({ id: 'shipment:one', fulfillment: 'fulfillment:one', state: 'draft', limits: [{ line: 'line:one', quantity: 3 }], packages: [], version: 0 });
    const first = shipment.add(Package.create({ id: 'package:one', shipment: 'shipment:one', tracking: 'TRACK-1', carrier: '顺丰', providerReference: null, state: 'shipped', lines: [{ line: 'line:one', quantity: 1 }], version: 0 }));
    expect(
      first.add(Package.create({ id: 'package:two', shipment: 'shipment:one', tracking: 'TRACK-2', carrier: '顺丰', providerReference: null, state: 'shipped', lines: [{ line: 'line:one', quantity: 2 }], version: 0 })).value.packages
    ).toHaveLength(2);
    expect(() => first.add(Package.create({ id: 'package:three', shipment: 'shipment:one', tracking: 'TRACK-3', carrier: '顺丰', providerReference: null, state: 'shipped', lines: [{ line: 'line:one', quantity: 3 }], version: 0 }))).toThrow(
      'FULFILLMENT_SHIPMENT_QUANTITY_EXCEEDED'
    );
  });

  it('stores out-of-order tracking without regressing package state', () => {
    const packageValue = Package.create({ id: 'package:one', shipment: 'shipment:one', tracking: 'TRACK-1', carrier: null, providerReference: null, state: 'intransit', lines: [{ line: 'line:one', quantity: 1 }], version: 0 });
    const delayed = TrackingEvent.record({
      id: 'tracking:one',
      package: 'package:one',
      external: 'provider:old',
      state: 'shipped',
      description: '较早轨迹',
      location: null,
      occurredAt: '2026-09-04T08:00:00.000Z',
      receivedAt: '2026-09-05T08:00:00.000Z',
      evidence: {},
    });
    const observed = packageValue.observe(delayed);
    expect(observed.value.state).toBe('intransit');
    expect(observed.value.events).toHaveLength(1);
    expect(observed.observe(delayed)).toBe(observed);
  });

  it('rejects a return quantity greater than fulfilled quantity', () => {
    expect(() => Return.create({ id: 'return:one', fulfillment: 'fulfillment:one', state: 'authorized', lines: [{ line: 'line:one', quantity: 2 }], fulfilled: [{ line: 'line:one', quantity: 1 }], version: 0 })).toThrow(
      'FULFILLMENT_RETURN_QUANTITY_EXCEEDED'
    );
  });

  it('splits physical, voucher and provider lines into deterministic plans', () => {
    const policy = new FulfillmentPolicy();
    const plans = policy.split([
      {
        suborder: 'suborder:internal',
        provider: null,
        partner: null,
        lines: [
          { line: 'line:physical', quantity: 1, payableMinor: 100, productType: 'physical' },
          { line: 'line:voucher', quantity: 2, payableMinor: 200, productType: 'voucher' },
        ],
      },
      { suborder: 'suborder:provider', provider: 'jdproduct', partner: 'partner:one', lines: [{ line: 'line:channel', quantity: 1, payableMinor: 300, productType: 'physical' }] },
    ]);
    expect(plans.map(({ route, kind, amountMinor }) => ({ route, kind, amountMinor }))).toEqual([
      { route: 'physical', kind: 'shipment', amountMinor: 100 },
      { route: 'voucher', kind: 'digital', amountMinor: 200 },
      { route: 'channel', kind: 'shipment', amountMinor: 300 },
    ]);
  });
});
