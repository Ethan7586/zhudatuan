import { describe, expect, it } from 'vitest';
import { apiError, json, methodNotAllowed } from './http';

describe('API HTTP responses', () => {
  it('applies non-cacheable JSON and defensive browser headers', () => {
    const response = json({ ok: true, requestId: 'request-1' });

    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-site');
    expect(response.headers.get('x-request-id')).toBe('request-1');
  });

  it('preserves stable API error semantics and allowed methods', async () => {
    const notAllowed = methodNotAllowed(['GET'], 'request-1');
    const error = apiError(403, 'FORBIDDEN', '拒绝访问', 'request-2');

    expect(notAllowed.status).toBe(405);
    expect(notAllowed.headers.get('allow')).toBe('GET');
    expect(notAllowed.headers.get('x-request-id')).toBe('request-1');
    expect(error.headers.get('x-request-id')).toBe('request-2');
    await expect(notAllowed.json()).resolves.toEqual({
      error: { code: 'METHOD_NOT_ALLOWED', message: '请求方法不受支持', requestId: 'request-1' },
    });
    await expect(error.json()).resolves.toEqual({
      error: { code: 'FORBIDDEN', message: '拒绝访问', requestId: 'request-2' },
    });
  });
});
