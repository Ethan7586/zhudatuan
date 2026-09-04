import { describe, expect, it, vi } from 'vitest';
import { PayoutGateway } from './PayoutGateway';

describe('finance provider gateways', () => {
  it('submits payout with the withdrawal idempotency key', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('idempotency-key')).toBe('withdrawal:1');
      return new Response(JSON.stringify({ reference: 'provider:1', state: 'paid' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    });
    const gateway = new PayoutGateway({ endpoint: 'https://payout.example.invalid', bearer: 'x'.repeat(32), provider: 'bank' }, fetcher);
    await expect(gateway.submit({ withdrawal: 'withdrawal:1', destination: 'secret:destination:1', amountMinor: 100, currency: 'CNY' }))
      .resolves.toEqual({ reference: 'provider:1', state: 'paid' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects malformed provider configuration', () => {
    expect(() => new PayoutGateway({ endpoint: 'http://unsafe.invalid', bearer: 'short', provider: 'BANK' }))
      .toThrow('PAYOUT_CONFIGURATION_INVALID');
  });
});
