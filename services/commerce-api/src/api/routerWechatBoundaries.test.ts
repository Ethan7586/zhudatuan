import { describe, expect, it } from 'vitest';
import { routeApi } from './router';
import type { WorkerEnv } from './types';

const env = {} as WorkerEnv;

async function errorCode(response: Response | null): Promise<string | undefined> {
  if (!response) return undefined;
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code;
}

describe('WeChat route authentication boundaries', () => {
  it.each(['/api/v1/auth/wechat/session', '/api/v1/auth/wechat/bind', '/api/v1/auth/wechat/register', '/api/v1/payments/wechat/notify'])('dispatches public endpoint %s before user authentication', async (pathname) => {
    const response = await routeApi(new Request(`https://hbbtzn.com${pathname}`), env);

    expect(response?.status).toBe(405);
    expect(response?.headers.get('allow')).toBe('POST');
    await expect(errorCode(response)).resolves.toBe('METHOD_NOT_ALLOWED');
  });

  it('keeps WeChat prepay behind user authentication', async () => {
    const response = await routeApi(new Request('https://hbbtzn.com/api/v1/orders/order-1/payments/wechat/prepay', { method: 'POST' }), env);

    expect(response?.status).toBe(401);
    await expect(errorCode(response)).resolves.toBe('AUTHENTICATION_REQUIRED');
  });
});
