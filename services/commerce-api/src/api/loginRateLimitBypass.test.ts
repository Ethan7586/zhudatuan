import { describe, expect, it, vi } from 'vitest';
import { handleLogin } from './publicRoutes';
import { isTestLoginRateLimitBypassed, normalizeClientIp, readTrustedClientIp } from './loginRateLimitBypass';
import type { WorkerEnv } from './types';

const ACTIVE_AT = Date.parse('2026-08-12T04:00:00Z');
const BASE_ENV: WorkerEnv = {
  APP_ENV: 'test',
  AUTH_MODE: 'test',
  TEST_LOGIN_RATE_LIMIT_BYPASS_IPS: '203.0.113.10,2001:db8::10',
  TEST_LOGIN_RATE_LIMIT_BYPASS_FROM: '2026-08-12T04:00:00Z',
  TEST_LOGIN_RATE_LIMIT_BYPASS_UNTIL: '2026-08-13T04:00:00Z',
};

describe('login rate-limit test bypass', () => {
  it('normalizes exact IPv4 and IPv6 addresses', () => {
    expect(normalizeClientIp(' 203.0.113.10 ')).toBe('203.0.113.10');
    expect(normalizeClientIp('2001:0db8:0:0:0:0:0:10')).toBe('2001:db8::10');
  });

  it.each(['unknown', '203.0.113.10, 198.51.100.2', '203.0.113.0/24', '[2001:db8::10]', '203.0.113.010'])('rejects ambiguous or non-canonical client address %s', (value) => {
    expect(normalizeClientIp(value)).toBeNull();
  });

  it('reads only the proxy-overwritten origin header', () => {
    const trusted = new Request('https://hbbtzn.com', {
      headers: { 'x-real-ip': '203.0.113.10', 'cf-connecting-ip': '198.51.100.2' },
    });
    const untrusted = new Request('https://hbbtzn.com', {
      headers: { 'cf-connecting-ip': '203.0.113.10' },
    });

    expect(readTrustedClientIp(trusted)).toBe('203.0.113.10');
    expect(readTrustedClientIp(untrusted)).toBeNull();
  });

  it('allows only an exact, active address in the test/test environment', () => {
    expect(isTestLoginRateLimitBypassed('203.0.113.10', BASE_ENV, ACTIVE_AT)).toBe(true);
    expect(isTestLoginRateLimitBypassed('2001:0db8:0:0:0:0:0:10', BASE_ENV, ACTIVE_AT)).toBe(true);
    expect(isTestLoginRateLimitBypassed('203.0.113.11', BASE_ENV, ACTIVE_AT)).toBe(false);
    expect(isTestLoginRateLimitBypassed('203.0.113.10', { ...BASE_ENV, APP_ENV: 'production' }, ACTIVE_AT)).toBe(false);
    expect(isTestLoginRateLimitBypassed('203.0.113.10', { ...BASE_ENV, AUTH_MODE: 'development' }, ACTIVE_AT)).toBe(false);
  });

  it('fails closed for inactive, expired or malformed configuration', () => {
    expect(isTestLoginRateLimitBypassed('203.0.113.10', BASE_ENV, Date.parse('2026-08-13T04:00:00Z'))).toBe(false);
    expect(isTestLoginRateLimitBypassed('203.0.113.10', BASE_ENV, Date.parse('2026-08-12T03:59:59.999Z'))).toBe(false);
    expect(isTestLoginRateLimitBypassed('203.0.113.10', { ...BASE_ENV, TEST_LOGIN_RATE_LIMIT_BYPASS_FROM: undefined }, ACTIVE_AT)).toBe(false);
    expect(isTestLoginRateLimitBypassed('203.0.113.10', { ...BASE_ENV, TEST_LOGIN_RATE_LIMIT_BYPASS_IPS: '203.0.113.10,' }, ACTIVE_AT)).toBe(false);
    expect(isTestLoginRateLimitBypassed('203.0.113.10', { ...BASE_ENV, TEST_LOGIN_RATE_LIMIT_BYPASS_IPS: '203.0.113.0/24' }, ACTIVE_AT)).toBe(false);
    expect(isTestLoginRateLimitBypassed('203.0.113.10', { ...BASE_ENV, TEST_LOGIN_RATE_LIMIT_BYPASS_UNTIL: '2026-02-31T04:00:00Z' }, Date.parse('2026-02-28T04:00:00Z'))).toBe(false);
    expect(isTestLoginRateLimitBypassed('203.0.113.10', { ...BASE_ENV, TEST_LOGIN_RATE_LIMIT_BYPASS_UNTIL: '2026-08-13T04:00:00.001Z' }, ACTIVE_AT)).toBe(false);
  });

  it('skips limiter storage but still rejects a bad password', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(ACTIVE_AT);
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('bypass must not access limiter storage'));
    try {
      const response = await handleLogin(
        new Request('https://smart.hbbtzn.com/api/v1/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.10' },
          body: JSON.stringify({ username: '福宝', password: 'wrong-password' }),
        }),
        {
          ...BASE_ENV,
          SESSION_SIGNING_KEY: 'test-session-signing-key-that-is-longer-than-32-bytes',
        },
        'bypassed-bad-password'
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'INVALID_USERNAME_PASSWORD', requestId: 'bypassed-bad-password' },
      });
      expect(log).toHaveBeenCalledWith(expect.stringContaining('login_rate_limit_bypassed'));
      expect(fetchRpc).not.toHaveBeenCalled();
    } finally {
      fetchRpc.mockRestore();
      log.mockRestore();
      vi.useRealTimers();
    }
  });

  it('returns 429 when a non-allowlisted address is blocked by limiter storage', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('false', { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleLogin(
        new Request('https://smart.hbbtzn.com/api/v1/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.11' },
          body: JSON.stringify({ username: '福宝', password: '123456' }),
        }),
        {
          ...BASE_ENV,
          SESSION_SIGNING_KEY: 'test-session-signing-key-that-is-longer-than-32-bytes',
          SUPABASE_URL: 'https://supabase.example',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        },
        'non-bypassed-blocked-login'
      );

      expect(response.status).toBe(429);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'LOGIN_RATE_LIMITED', requestId: 'non-bypassed-blocked-login' },
      });
      expect(fetchRpc).toHaveBeenCalledTimes(1);
      expect(String(fetchRpc.mock.calls[0][0])).toContain('/rest/v1/rpc/api_login_allowed');
    } finally {
      fetchRpc.mockRestore();
    }
  });
});
