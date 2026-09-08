import { describe, expect, it, vi } from 'vitest';
import { InvoiceGateway } from './InvoiceGateway';
import { PayoutGateway } from './PayoutGateway';
import { Failure } from '../../../../platform/error/Failure';

describe('finance provider gateways', () => {
  it('submits payout with the withdrawal idempotency key', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('idempotency-key')).toBe('withdrawal:1');
      expect(new Headers(init?.headers).get('x-input-hash')).toBe('a'.repeat(64));
      return new Response(JSON.stringify({ reference: 'provider:1', state: 'paid' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const gateway = new PayoutGateway({ endpoint: 'https://payout.example.invalid', bearer: 'x'.repeat(32), provider: 'bank' }, fetcher);
    await expect(gateway.submit({ withdrawal: 'withdrawal:1', inputHash: 'a'.repeat(64), destination: 'secret:destination:1', amountMinor: 100, currency: 'CNY' })).resolves.toEqual({
      provider: 'bank',
      reference: 'provider:1',
      state: 'paid',
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects malformed provider configuration', () => {
    expect(() => new PayoutGateway({ endpoint: 'http://unsafe.invalid', bearer: 'short', provider: 'BANK' })).toThrow('PAYOUT_CONFIGURATION_INVALID');
  });

  it('maps provider rejection to a classified retryable failure', async () => {
    const gateway = new PayoutGateway({ endpoint: 'https://payout.example.invalid', bearer: 'x'.repeat(32), provider: 'bank' }, async () => new Response('{"code":"busy"}', { status: 503, headers: { 'content-type': 'application/json' } }));

    const failure = await gateway.submit({ withdrawal: 'withdrawal:1', inputHash: 'a'.repeat(64), destination: 'secret:destination:1', amountMinor: 100, currency: 'CNY' }).catch((cause: unknown) => cause);
    expect(failure).toBeInstanceOf(Failure);
    expect(failure).toMatchObject({ code: 'PAYOUT_PROVIDER_UNAVAILABLE', kind: 'unavailable', retryable: true, status: 503 });
  });

  it('maps malformed provider JSON to a non-retryable response failure', async () => {
    const gateway = new InvoiceGateway({ endpoint: 'https://invoice.example.invalid', bearer: 'x'.repeat(32), provider: 'tax' }, async () => new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }));
    const input = { request: 'invoice:1', inputHash: 'b'.repeat(64), kind: 'original' as const, title: '测试企业', taxid: '91310000TEST', amountMinor: 100, currency: 'CNY', lines: [{ description: '商品', amountMinor: 100, taxMinor: 6 }] };

    await expect(gateway.issue(input)).rejects.toMatchObject({ code: 'INVOICE_PROVIDER_RESPONSE_INVALID', kind: 'response', retryable: false });
  });

  it('reuses the invoice business number and frozen hash for provider recovery', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('idempotency-key')).toBe('invoice:1');
      expect(headers.get('x-input-hash')).toBe('b'.repeat(64));
      return new Response(JSON.stringify({ externalId: 'provider-invoice:1', documentBase64: Buffer.from('%PDF-test').toString('base64'), contentType: 'application/pdf' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const gateway = new InvoiceGateway({ endpoint: 'https://invoice.example.invalid', bearer: 'x'.repeat(32), provider: 'tax' }, fetcher);
    const input = { request: 'invoice:1', inputHash: 'b'.repeat(64), kind: 'original' as const, title: '测试企业', taxid: '91310000TEST', amountMinor: 100, currency: 'CNY', lines: [{ description: '商品', amountMinor: 100, taxMinor: 6 }] };

    const first = await gateway.issue(input);
    const recovered = await gateway.issue(input);

    expect(recovered).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
