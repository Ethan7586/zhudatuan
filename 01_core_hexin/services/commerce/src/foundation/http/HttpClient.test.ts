import { describe, expect, it } from 'vitest';
import { HttpClient } from './HttpClient';

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
    const client = new HttpClient(async () => { calls += 1; throw new Error('network'); });
    await expect(client.send('https://dependency.example/write', { method: 'POST' }, { mode: 'none' })).rejects.toThrow('HTTP_TRANSPORT_FAILED');
    expect(calls).toBe(1);
  });

  it('preserves a no-content response without retrying the write', async () => {
    let calls = 0;
    const client = new HttpClient(async () => { calls += 1; return new Response(null, { status: 204 }); });
    const response = await client.send('https://dependency.example/write', { method: 'PUT' }, { mode: 'businesskeywrite' });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(calls).toBe(1);
  });
});
