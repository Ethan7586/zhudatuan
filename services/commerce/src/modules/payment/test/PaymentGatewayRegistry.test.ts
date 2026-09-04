import { describe, expect, it } from 'vitest';
import { PaymentGatewayRegistry } from '../application/service/PaymentGatewayRegistry';

describe('payment gateway manifest registry', () => {
  it('loads a gateway only when its manifest declares the requested scene and capability', () => {
    const gateway = { manifest: { id: 'wechat', scenes: ['miniapp', 'jsapi'], capabilities: ['prepay', 'query'] } } as never;
    const registry = new PaymentGatewayRegistry([gateway]);
    expect(registry.require('prepay', 'miniapp')).toBe(gateway);
    expect(() => registry.require('refund', 'miniapp')).toThrow('PAYMENT_GATEWAY_CAPABILITY_UNAVAILABLE');
  });
});
