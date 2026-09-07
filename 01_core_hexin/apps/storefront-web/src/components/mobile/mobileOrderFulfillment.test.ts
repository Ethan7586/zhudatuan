import { describe, expect, it } from 'vitest';
import type { FrontendOrder } from '../../adapters/frontendData';
import {
  effectiveMobileFulfillmentStage,
  mobileFulfillmentSimulationAction,
  nextMobileFulfillmentStage,
  summarizeMobileFulfillment,
} from './mobileOrderFulfillment';

const orderWithStatus = (status: FrontendOrder['status']): FrontendOrder => ({ status } as FrontendOrder);

describe('mobile order fulfillment presentation', () => {
  it('uses one count and the most urgent active stage for both order entries', () => {
    const summary = summarizeMobileFulfillment([
      orderWithStatus('pending_receipt'),
      orderWithStatus('pending_shipment'),
      orderWithStatus('completed'),
    ], null);

    expect(summary).toEqual({ count: 2, stage: 'processing', label: '待处理' });
  });

  it('lets the preview stage synchronously replace the active bucket label', () => {
    const orders = [orderWithStatus('pending_shipment'), orderWithStatus('pending_receipt')];

    expect(summarizeMobileFulfillment(orders, 'shipped')).toEqual({ count: 2, stage: 'shipped', label: '已发货' });
    expect(summarizeMobileFulfillment(orders, 'received')).toEqual({ count: 2, stage: 'received', label: '已收货' });
    expect(effectiveMobileFulfillmentStage(orders[0]!, 'received')).toBe('received');
  });

  it('cycles through the three front-end simulation stages', () => {
    expect(nextMobileFulfillmentStage('processing')).toBe('shipped');
    expect(nextMobileFulfillmentStage('shipped')).toBe('received');
    expect(nextMobileFulfillmentStage('received')).toBe('processing');
    expect(mobileFulfillmentSimulationAction('received')).toBe('重新演示');
  });
});
