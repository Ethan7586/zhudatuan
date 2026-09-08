import { describe, expect, it } from 'vitest';
import { HttpClient } from './HttpClient';
import { Failure } from '../error/Failure';

describe('HttpClient', () => {
  it('retries a safe read after a transport failure', async () => {
    let calls = 0;
    const client = new HttpClient(async () => {
      calls += 1;
      if (calls === 1) throw new Error('network');
      return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const response = await client.send('https://dependency.example/read', { method: 'GET' }, { mode: 'read' });
    expect(await response.json()).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('does not retry an unsafe call', async () => {
    let calls = 0;
    const client = new HttpClient(async () => {
      calls += 1;
      throw new Error('network');
    });
    await expect(client.send('https://dependency.example/write', { method: 'POST' }, { mode: 'none' })).rejects.toMatchObject({
      name: 'Failure',
      code: 'HTTP_TRANSPORT_FAILED',
      kind: 'transport',
      retryable: true,
    });
    expect(calls).toBe(1);
  });

  it('preserves a no-content response without retrying the write', async () => {
    let calls = 0;
    const client = new HttpClient(async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    });
    const response = await client.send('https://dependency.example/write', { method: 'PUT' }, { mode: 'businesskeywrite' });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(calls).toBe(1);
  });

  it('rejects an oversized dependency response before materializing it', async () => {
    const client = new HttpClient(async () => new Response('x'.repeat(2 * 1024 * 1024 + 1)));
    await expect(client.send('https://dependency.example/large', {}, { mode: 'read' })).rejects.toMatchObject({
      code: 'HTTP_RESPONSE_TOO_LARGE',
      kind: 'response',
      retryable: false,
    });
  });

  it('never exposes an arbitrary transport exception as the public failure message', async () => {
    const client = new HttpClient(async () => {
      throw new Error('authorization bearer secret');
    });
    const failure = await client.send('https://dependency.example/read', {}, { mode: 'none' }).catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(Failure);
    expect(failure).toMatchObject({ code: 'HTTP_TRANSPORT_FAILED', kind: 'transport', retryable: true });
    expect(String(failure)).not.toContain('bearer');
  });
});
