import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleRegistration, handleRegistrationOtp, handleUsernameRegistration } from './registrationRoutes';
import type { WorkerEnv } from './types';

const env: WorkerEnv = {
  APP_ENV: 'test',
  AUTH_MODE: 'test',
  SELF_REGISTRATION_ENABLED: 'true',
  SMS_PROVIDER: 'debug',
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
  IDENTITY_LOOKUP_KEY: 'identity-key-that-is-longer-than-thirty-two-bytes',
  PII_ENCRYPTION_KEY: btoa('12345678901234567890123456789012'),
};

afterEach(() => vi.unstubAllGlobals());

describe('member registration routes', () => {
  it('creates a random debug challenge without exposing it in production', async () => {
    const database = vi.fn(async (_input: string | URL | Request) => new Response('true', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', database);
    const response = await handleRegistrationOtp(post('/otp', { mobile: '13800138000' }), env, 'otp-request');
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.challengeId).toEqual(expect.any(String));
    expect(payload.debugCode).toMatch(/^\d{6}$/);
    expect(database.mock.calls.map(([input]) => String(input))).toEqual([expect.stringContaining('/rpc/api_create_registration_challenge'), expect.stringContaining('/rpc/api_record_phone_challenge_delivery')]);

    const production = await handleRegistrationOtp(post('/otp', { mobile: '13800138000' }), { ...env, APP_ENV: 'production', SMS_PROVIDER: 'debug' }, 'prod-request');
    expect(production.status).toBe(503);
    await expect(production.json()).resolves.toMatchObject({ error: { code: 'SMS_PROVIDER_NOT_CONFIGURED' } });
  });

  it('rejects weak passwords before a database write', async () => {
    const database = vi.fn();
    vi.stubGlobal('fetch', database);
    const response = await handleRegistration(
      post('/register', {
        mobile: '13800138000',
        challengeId: crypto.randomUUID(),
        code: '123456',
        displayName: '新员工',
        inviteCode: 'SW-DEMO-EMPLOYEE-2026',
        password: '123456',
      }),
      env,
      'register-request'
    );
    expect(response.status).toBe(422);
    expect(database).not.toHaveBeenCalled();
  });

  it('maps a valid invitation result to a created storefront account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: 'active', employeeNo: 'REG-123' }), { status: 200, headers: { 'content-type': 'application/json' } }))
    );
    const response = await handleRegistration(
      post('/register', {
        mobile: '13800138000',
        challengeId: crypto.randomUUID(),
        code: '123456',
        displayName: '新员工',
        inviteCode: 'SW-DEMO-EMPLOYEE-2026',
        password: 'SmartWing2026',
      }),
      env,
      'register-request'
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ registered: true, status: 'active', employeeNo: 'REG-123' });
  });

  it('creates a username account only after the registration limiter allows it', async () => {
    const responses: unknown[] = [true, { status: 'active', username: 'new.employee', employeeNo: 'REG-USERNAME' }];
    const database = vi.fn(async (_input: unknown, _init?: unknown) => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', database);
    const response = await handleUsernameRegistration(
      post('/username', {
        username: 'New.Employee',
        displayName: '新员工',
        inviteCode: 'SW-DEMO-EMPLOYEE-2026',
        password: 'SmartWing2026',
        acceptedTerms: true,
      }),
      env,
      'username-register'
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      registered: true,
      username: 'new.employee',
      employeeNo: 'REG-USERNAME',
      phoneBound: false,
    });
    expect(database).toHaveBeenCalledTimes(2);
    const calls = database.mock.calls as unknown as Array<[unknown, { body?: unknown }?]>;
    expect(String(calls[0]?.[0])).toContain('/rpc/api_username_registration_allowed');
    expect(String(calls[1]?.[0])).toContain('/rpc/api_register_username_member');
    const transactionRequest = calls[1]?.[1];
    expect(JSON.parse(String(transactionRequest?.body))).toMatchObject({
      p_username: 'new.employee',
      p_display_name: '新员工',
      p_terms_version: '2026-08-13',
    });
  });

  it('rejects an invalid username and weak password before database access', async () => {
    const database = vi.fn();
    vi.stubGlobal('fetch', database);
    const invalidUsername = await handleUsernameRegistration(
      post('/username', {
        username: '123employee',
        displayName: '新员工',
        inviteCode: 'SW-DEMO-EMPLOYEE-2026',
        password: 'SmartWing2026',
        acceptedTerms: true,
      }),
      env,
      'invalid-username'
    );
    const weakPassword = await handleUsernameRegistration(
      post('/username', {
        username: 'newemployee',
        displayName: '新员工',
        inviteCode: 'SW-DEMO-EMPLOYEE-2026',
        password: '123456',
        acceptedTerms: true,
      }),
      env,
      'weak-username-password'
    );
    expect(invalidUsername.status).toBe(422);
    expect(weakPassword.status).toBe(422);
    expect(database).not.toHaveBeenCalled();
  });

  it('rate-limits username registration before hashing the password or writing an account', async () => {
    const database = vi.fn(async (_input: unknown, _init?: unknown) => new Response('false', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', database);
    const response = await handleUsernameRegistration(
      post('/username', {
        username: 'limited.employee',
        displayName: '新员工',
        inviteCode: 'SW-DEMO-EMPLOYEE-2026',
        password: 'SmartWing2026',
        acceptedTerms: true,
      }),
      env,
      'limited-registration'
    );
    expect(response.status).toBe(429);
    expect(database).toHaveBeenCalledTimes(1);
    const calls = database.mock.calls as unknown as Array<[unknown, unknown?]>;
    expect(String(calls[0]?.[0])).toContain('/rpc/api_username_registration_allowed');
  });

  it('keeps username registration closed in production until explicitly enabled', async () => {
    const database = vi.fn();
    vi.stubGlobal('fetch', database);
    const response = await handleUsernameRegistration(
      post('/username', {
        username: 'newemployee',
        displayName: '新员工',
        inviteCode: 'SW-DEMO-EMPLOYEE-2026',
        password: 'SmartWing2026',
        acceptedTerms: true,
      }),
      { ...env, APP_ENV: 'production', USERNAME_REGISTRATION_ENABLED: 'false' },
      'closed-registration'
    );
    expect(response.status).toBe(503);
    expect(database).not.toHaveBeenCalled();
  });
});

function post(path: string, body: unknown): Request {
  return new Request(`https://hbbtzn.com/api/v1/auth/registration${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9' },
    body: JSON.stringify(body),
  });
}
