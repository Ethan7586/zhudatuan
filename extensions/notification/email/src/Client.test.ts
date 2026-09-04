import { describe, expect, it, vi } from 'vitest';
import { EmailClient } from './Client';
import { EmailCatalog } from './Catalog';

describe('email notification extension', () => {
  it('uses provider idempotency and never serializes its credential', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'mail:one' }), { status: 200 }));
    const client = new EmailClient({ endpoint: 'https://mail.example.test', provider: 'mailer', sender: 'shop@example.test', credentialRef: 'secret/mail' as never, priority: 10 }, '0123456789abcdef', fetcher);
    await expect(client.send({ recipient: 'member@example.test', providerTemplate: 'paid', purpose: 'transactional', variables: { order: 'O1' }, subject: '支付成功', body: '正文', idempotency: 'dispatch:one',
      requestId: 'dispatch:one', traceId: 'trace:one', deadline: Date.now() + 1_000, signal: new AbortController().signal }))
      .resolves.toEqual({ provider: 'mailer', externalId: 'mail:one' });
    const headers = new Headers(fetcher.mock.calls[0]![1]!.headers);
    expect(headers.get('idempotency-key')).toBe('dispatch:one');
    expect(headers.get('x-request-id')).toBe('dispatch:one');
    expect(headers.get('x-trace-id')).toBe('trace:one');
    expect(String(fetcher.mock.calls[0]![1]!.body)).not.toContain('0123456789abcdef');
    expect(EmailCatalog.settings.find(({ key }) => key === 'credentialRef')).toMatchObject({ secret: true });
  });

  it('does not enter transport after its parent task is cancelled', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new EmailClient({ endpoint: 'https://mail.example.test', provider: 'mailer', sender: 'shop@example.test', credentialRef: 'secret/mail' as never, priority: 10 }, '0123456789abcdef', fetcher);
    const controller = new AbortController();
    controller.abort(new Error('TASK_CANCELLED'));
    await expect(client.send({ recipient: 'member@example.test', providerTemplate: 'paid', purpose: 'transactional', variables: {}, subject: '通知', body: '正文', idempotency: 'dispatch:one', signal: controller.signal })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
