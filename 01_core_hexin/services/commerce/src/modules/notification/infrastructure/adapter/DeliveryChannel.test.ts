import { describe, expect, it, vi } from 'vitest';
import { EmailChannel } from './EmailChannel';
import { WechatChannel } from './WechatChannel';

describe('notification delivery extensions', () => {
  it('uses provider idempotency for email without leaking configuration into the payload', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'mail-1' }),
      { status: 200, headers: { 'content-type': 'application/json' } }));
    const channel = new EmailChannel({ endpoint: 'https://mail.example.test', bearer: '0123456789abcdef', provider: 'mailer',
      sender: 'shop@example.test' }, fetcher);
    await expect(channel.send({ recipient: 'member@example.test', providerTemplate: 'paid', variables: { order: 'O1' },
      subject: '支付成功', body: '正文', idempotency: 'dispatch-1' })).resolves.toEqual({ provider: 'mailer', externalId: 'mail-1' });
    const request = fetcher.mock.calls[0]![1]!;
    expect(new Headers(request.headers).get('idempotency-key')).toBe('dispatch-1');
    expect(String(request.body)).not.toContain('0123456789abcdef');
  });

  it('caches the WeChat token and sends only declared variables', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => String(input).includes('/cgi-bin/token')
      ? new Response(JSON.stringify({ access_token: 'token-0123456789abcdef', expires_in: 7200 }), { status: 200 })
      : new Response(JSON.stringify({ errcode: 0, msgid: 123 }), { status: 200 }));
    const channel = new WechatChannel({ appId: 'app12345', appSecret: '0123456789abcdef', state: 'formal' }, fetcher);
    const request = { recipient: 'openid_12345678', providerTemplate: 'template_12345678', variables: { order: 'O1' },
      subject: null, body: '正文', idempotency: 'dispatch-1' } as const;
    await channel.send(request); await channel.send({ ...request, idempotency: 'dispatch-2' });
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/cgi-bin/token'))).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
