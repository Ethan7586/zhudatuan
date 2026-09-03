import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCanonicalLoginChallenge,
  createCanonicalPasswordResetChallenge,
  currentCanonicalStorefrontOrganization,
  loginCanonicalConsole,
  loginCanonicalConsoleWithOtp,
  loginCanonicalStorefront,
  resetCanonicalPassword,
} from './canonicalIdentity';

const SESSION_TICKET = 't'.repeat(64);
const CALLBACK_STATE = 's'.repeat(32);
const VALID_CSRF = 'csrf-token-at-least-sixteen-characters';
const VALID_PROOF = 'signed-return-target-proof';
const CONSOLE_DESTINATION = 'http://127.0.0.1:4173/scopes/platform/platform%3Apreview/cockpit';
const STOREFRONT_DESTINATION = 'http://127.0.0.1:3000/';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

describe('canonical storefront session', () => {
  it('recognizes the already signed-in L1 before reopening consumer registration', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({
      target: 'storefront',
      governance: { organization: 'mall:l1-hongtai' },
      actor: 'principal:one',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(currentCanonicalStorefrontOrganization()).resolves.toBe('mall:l1-hongtai');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://127.0.0.1:3001/api/v1/identity/session');
    expect(init).toMatchObject({ method: 'GET', credentials: 'include', redirect: 'error' });
  });

  it('treats an absent storefront session as unauthenticated', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ code: 'AUTHENTICATION_REQUIRED' }, 401)));
    await expect(currentCanonicalStorefrontOrganization()).resolves.toBeNull();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('canonical console identity', () => {
  it('requests a login-only challenge for the canonical mobile number', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({
      id: 'challenge:login:1234567890',
      purpose: 'login',
      expires_at: '2099-01-01T00:00:00.000Z',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createCanonicalLoginChallenge('138 0013 8000')).resolves.toEqual({
      challengeId: 'challenge:login:1234567890',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://127.0.0.1:3001/api/v1/identity/challenges');
    expect(JSON.parse(String(init?.body))).toEqual({ purpose: 'login', destination: '+8613800138000' });
  });

  it('uses the OTP credential without sending a password', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(sessionCreated()))
      .mockResolvedValueOnce(jsonResponse(ticketExchanged(CONSOLE_DESTINATION)));
    vi.stubGlobal('fetch', fetchMock);

    await loginCanonicalConsoleWithOtp('13800138000', 'challenge:login:1234567890', '123456');

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      provider: 'phone_otp',
      subject: '+8613800138000',
      challenge: 'challenge:login:1234567890',
      code: '123456',
      target: 'console',
    });
    expect(body).not.toHaveProperty('password');
  });

  it('normalizes a mobile password subject exactly like registration', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(sessionCreated()))
      .mockResolvedValueOnce(jsonResponse(ticketExchanged(CONSOLE_DESTINATION)));
    vi.stubGlobal('fetch', fetchMock);

    await loginCanonicalConsole('192 8724 7586', 'Original!Password1');

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      provider: 'password',
      subject: '+8619287247586',
      password: 'Original!Password1',
      target: 'console',
    });
  });

  it('uses the public canonical challenge and reset operations for password recovery', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        id: 'challenge:password-reset:1234567890',
        purpose: 'password_reset',
        expires_at: '2099-01-01T00:00:00.000Z',
      }, 202))
      .mockResolvedValueOnce(jsonResponse({ credential_version: 2, version: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createCanonicalPasswordResetChallenge('19287247586')).resolves.toEqual({
      challengeId: 'challenge:password-reset:1234567890',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    await resetCanonicalPassword('challenge:password-reset:1234567890', '123456', 'Replacement!Password2');

    expect(String(fetchMock.mock.calls[0][0])).toBe('http://127.0.0.1:3001/api/v1/identity/challenges');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'omit' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      purpose: 'password_reset',
      destination: '+8619287247586',
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe('http://127.0.0.1:3001/api/v1/identity/password/reset');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'omit' });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      challenge: 'challenge:password-reset:1234567890',
      code: '123456',
      newPassword: 'Replacement!Password2',
    });
  });

  it('creates and exchanges a session while preserving credentials and request metadata', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(sessionCreated()))
      .mockResolvedValueOnce(jsonResponse(ticketExchanged(CONSOLE_DESTINATION)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await loginCanonicalConsole('  ethan  ', '  original password  ');

    expect(result).toEqual({
      kind: 'authenticated',
      membership: 'membership-console-owner',
      redirectUrl: CONSOLE_DESTINATION,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [sessionUrl, sessionInit] = fetchMock.mock.calls[0];
    expect(String(sessionUrl)).toBe('http://127.0.0.1:3001/api/v1/identity/sessions');
    expect(sessionInit).toMatchObject({ method: 'POST', credentials: 'include' });
    const sessionHeaders = sessionInit?.headers as Record<string, string>;
    expect(sessionHeaders).toMatchObject({
      'content-type': 'application/json',
      'x-client-version': '0.0.0',
      'x-contract-version': expect.any(String),
      'x-device-id': expect.any(String),
      'x-request-id': expect.any(String),
      'idempotency-key': expect.any(String),
    });
    expect(sessionHeaders['x-contract-version']).not.toBe('');

    const sessionBody = JSON.parse(String(sessionInit?.body));
    expect(sessionBody).toMatchObject({
      provider: 'password',
      subject: 'ethan',
      password: '  original password  ',
      target: 'console',
      authorization: {
        state: expect.any(String),
        nonce: expect.any(String),
        challenge: expect.any(String),
      },
    });

    const [exchangeUrl, exchangeInit] = fetchMock.mock.calls[1];
    expect(String(exchangeUrl)).toBe('http://127.0.0.1:3001/api/v1/identity/tickets/exchange');
    expect(exchangeInit).toMatchObject({ method: 'POST', credentials: 'include' });
    const exchangeHeaders = exchangeInit?.headers as Record<string, string>;
    expect(exchangeHeaders['x-device-id']).toBe(sessionHeaders['x-device-id']);
    expect(exchangeHeaders['idempotency-key']).not.toBe(sessionHeaders['idempotency-key']);
    expect(exchangeHeaders['x-request-id']).not.toBe(sessionHeaders['x-request-id']);

    const exchangeBody = JSON.parse(String(exchangeInit?.body));
    expect(exchangeBody).toMatchObject({
      ticket: SESSION_TICKET,
      state: CALLBACK_STATE,
      nonce: sessionBody.authorization.nonce,
      verifier: expect.any(String),
    });
    expect(exchangeBody.verifier).not.toBe(sessionBody.authorization.challenge);
  });

  it('logs a newly registered consumer into its exact storefront membership before redirecting', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(sessionCreated('storefront', 'membership:storefront-one')))
      .mockResolvedValueOnce(jsonResponse(ticketExchanged(STOREFRONT_DESTINATION)));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginCanonicalStorefront(
      '+8613800138000',
      'Generated!Password2',
      'membership:storefront-one',
    )).resolves.toEqual({
      membership: 'membership:storefront-one',
      redirectUrl: STOREFRONT_DESTINATION,
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      provider: 'password',
      subject: '+8613800138000',
      password: 'Generated!Password2',
      membership: 'membership:storefront-one',
      target: 'storefront',
    });
  });

  it('maps a canonical console membership selection to the approved admin UI model', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({
      principal: 'principal-owner',
      memberships: [{ id: 'membership-console-owner', client: 'console' }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await loginCanonicalConsole('  owner@example.com  ', 'secret');

    expect(result).toEqual({
      kind: 'selection',
      context: {
        identifier: 'owner@example.com',
        loginMethod: 'password',
        memberships: [{
          id: 'membership-console-owner',
          target: 'admin',
          status: 'active',
          enterpriseName: '已授权企业',
          storeName: '主打团运营后台',
          roleName: '运营会员',
          dataScope: '按权限系统授权范围',
          subjectScope: '企业',
          requiresStepUp: false,
        }],
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an exchanged return target outside the approved console origin', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(sessionCreated()))
      .mockResolvedValueOnce(jsonResponse(ticketExchanged('https://attacker.example/capture')));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginCanonicalConsole('ethan', 'secret')).rejects.toThrow('登录回跳地址不在后台允许清单');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function sessionCreated(target: 'console' | 'storefront' = 'console', membership = 'membership-console-owner'): Readonly<Record<string, unknown>> {
  return {
    session: 'session-reference',
    csrf: VALID_CSRF,
    expiresIn: 3_600,
    membership,
    target,
    callback: {
      ticket: SESSION_TICKET,
      state: CALLBACK_STATE,
    },
  };
}

function ticketExchanged(url: string): Readonly<Record<string, unknown>> {
  return {
    returnTarget: {
      url,
      proof: VALID_PROOF,
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
    expiresIn: 3_600,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
