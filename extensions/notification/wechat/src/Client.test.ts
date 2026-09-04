import { describe, expect, it, vi } from 'vitest';
import { WechatClient } from './Client';

describe('wechat notification extension', () => {
  it('singleflights token loading and sends only declared variables', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => String(input).includes('/cgi-bin/token')
      ? new Response(JSON.stringify({ access_token: 'token-0123456789abcdef', expires_in: 7200 }), { status: 200 })
      : new Response(JSON.stringify({ errcode: 0, msgid: 123 }), { status: 200 }));
    const client = new WechatClient({ appId: 'app12345', credentialRef: 'secret/wechat' as never, page: null, state: 'formal', priority: 10,
      templates: { paid: { id: 'template_12345678', variables: { order: 'character_string1' } } } }, '0123456789abcdef', fetcher);
    const request = { recipient: 'openid_12345678', providerTemplate: 'paid', purpose: 'transactional', authorization: 'accepted', variables: { order: 'O1' }, subject: null, body: '正文', idempotency: 'dispatch:one',
      requestId: 'dispatch:one', traceId: 'trace:one', deadline: Date.now() + 1_000, signal: new AbortController().signal } as const;
    await Promise.all([client.send(request), client.send({ ...request, idempotency: 'dispatch:two' })]);
    expect(fetcher.mock.calls.filter(([input]) => String(input).includes('/cgi-bin/token'))).toHaveLength(1);
    const payload = JSON.parse(String(fetcher.mock.calls.find(([input]) => String(input).includes('/message/subscribe/send'))?.[1]?.body));
    expect(payload).toMatchObject({ template_id: 'template_12345678', data: { character_string1: { value: 'O1' } } });
    expect(payload.data).not.toHaveProperty('order');
    const headers = new Headers(fetcher.mock.calls.find(([input]) => String(input).includes('/message/subscribe/send'))?.[1]?.headers);
    expect(headers.get('x-request-id')).toBe('dispatch:one');
    expect(headers.get('x-trace-id')).toBe('trace:one');
  });

  it('fails closed when template authorization is absent', async () => {
    const client = new WechatClient({ appId: 'app12345', credentialRef: 'secret/wechat' as never, page: null, state: 'formal', priority: 10,
      templates: { paid: { id: 'template_12345678', variables: { order: 'character_string1' } } } }, '0123456789abcdef', vi.fn());
    await expect(client.send({ recipient: 'openid_12345678', providerTemplate: 'paid', purpose: 'transactional', variables: { order: 'O1' }, subject: null, body: '正文', idempotency: 'dispatch:one' }))
      .rejects.toThrow('WECHAT_SUBSCRIPTION_AUTHORIZATION_REQUIRED');
  });

  it('does not load a token after its parent task is cancelled', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new WechatClient({ appId: 'app12345', credentialRef: 'secret/wechat' as never, page: null, state: 'formal', priority: 10,
      templates: { paid: { id: 'template_12345678', variables: { order: 'character_string1' } } } }, '0123456789abcdef', fetcher);
    const controller = new AbortController();
    controller.abort(new Error('TASK_CANCELLED'));
    await expect(client.send({ recipient: 'openid_12345678', providerTemplate: 'paid', purpose: 'transactional', authorization: 'accepted', variables: { order: 'O1' }, subject: null,
      body: '正文', idempotency: 'dispatch:one', signal: controller.signal })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
