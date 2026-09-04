import { describe, expect, it, vi } from 'vitest';
import { WebhooksWechatHandler } from '../application/handler/WebhooksWechatHandler';

describe('payment webhook boundary', () => {
  it('rejects forged input before scope resolution and Inbox persistence', async () => {
    const scopes = { resolve: vi.fn() };
    const webhooks = { accept: vi.fn() };
    const handler = new WebhooksWechatHandler({ verifyNotification: vi.fn(async () => { throw new Error('PROVIDER_SIGNATURE_INVALID'); }) } as never, scopes as never, webhooks as never);
    await expect(handler.prepare({} as never, prepareContext() as never)).rejects.toThrow('PROVIDER_SIGNATURE_INVALID');
    expect(scopes.resolve).not.toHaveBeenCalled();
    expect(webhooks.accept).not.toHaveBeenCalled();
  });

  it('acknowledges a verified duplicate without scheduling business work in the HTTP handler', async () => {
    const notification = { kind: 'payment', id: 'event:one', providerReference: 'P1', transaction: 'T1', amountMinor: 100, currency: 'CNY', payerHash: 'a'.repeat(64),
      application: { scene: 'miniapp', applicationHash: 'b'.repeat(64) }, occurredAt: '2026-09-05T00:00:00.000Z', evidence: {} } as const;
    const handler = new WebhooksWechatHandler({ verifyNotification: vi.fn(async () => notification) } as never, { resolve: vi.fn(async () => 'mall:one') } as never,
      { accept: vi.fn(async () => ({ replayed: true })) } as never);
    const prepared = await handler.prepare({} as never, prepareContext() as never);
    const committed = await handler.commit({} as never, prepared, { transaction: {} } as never);
    expect(committed).toMatchObject({ checkpoint: { replayed: true }, response: { status: 204, body: {} } });
  });
});

function prepareContext() {
  return { rawBody: '{"event_type":"TRANSACTION.SUCCESS"}', headers: { 'wechatpay-signature': 'signature', 'request-id': 'request:one' }, signal: new AbortController().signal, deadline: Date.now() + 10_000 };
}
