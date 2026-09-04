import { describe, expect, it } from 'vitest';
import { PAYMENT_CAPABILITIES } from '../01_public_gongkai/PaymentCapabilities';
import { paymentManifest } from '../module.manifest';

describe('payment module manifest', () => {
  it('keeps the stable payment identity and public entry', () => {
    expect(paymentManifest.id).toBe('payment');
    expect(paymentManifest.publicEntry).toBe('./index.ts');
    expect(paymentManifest.provides).toEqual(Object.values(PAYMENT_CAPABILITIES));
  });

  it('declares the implemented payment operations and entrypoints', () => {
    expect(paymentManifest.operations).toContain('payment.intents.create');
    expect(paymentManifest.operations).toContain('payment.webhooks.wechat');
    expect(paymentManifest.entrypoints.jobs).toEqual(['PaymentJobProcessor']);
  });
});
