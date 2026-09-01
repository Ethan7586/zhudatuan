import { describe, expect, it } from 'vitest';
import { DisabledExternalPaymentGateway } from './DisabledExternalPaymentGateway';

describe('disabled external payment gateway', () => {
  it('resolves only a deterministic application context', () => {
    const gateway = new DisabledExternalPaymentGateway();
    expect(gateway.application('jsapi')).toEqual({ scene: 'jsapi', applicationHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(gateway.application('miniapp').applicationHash).not.toBe(gateway.application('jsapi').applicationHash);
  });

  it('fails closed on every provider interaction', async () => {
    const gateway = new DisabledExternalPaymentGateway();
    const application = gateway.application('jsapi');
    await expect(gateway.prepay({ description: 'order', orderNumber: 'SW1', amountMinor: 1, payer: 'payer',
      application, expiresAt: new Date().toISOString() })).rejects.toThrow('EXTERNAL_PAYMENT_DISABLED');
    await expect(gateway.query('SW1', application)).rejects.toThrow('EXTERNAL_PAYMENT_DISABLED');
    await expect(gateway.close('SW1', application)).rejects.toThrow('EXTERNAL_PAYMENT_DISABLED');
    await expect(gateway.refund({ refundNumber: 'R1', transaction: 'T1', refundMinor: 1, totalMinor: 1, reason: 'test' }))
      .rejects.toThrow('EXTERNAL_PAYMENT_DISABLED');
    await expect(gateway.queryRefund('R1')).rejects.toThrow('EXTERNAL_PAYMENT_DISABLED');
    await expect(gateway.verifyNotification({}, '{}')).rejects.toThrow('EXTERNAL_PAYMENT_DISABLED');
  });
});
