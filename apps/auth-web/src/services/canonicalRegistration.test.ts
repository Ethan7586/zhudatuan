import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanonicalMember, createCanonicalRegistrationChallenge, resolveCanonicalInvite } from './canonicalRegistration';

const TERMS_HASH = 'a'.repeat(64);

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('canonical registration', () => {
  it('resolves an invitation and maps the authoritative terms without leaking the invite into the URL', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(invitation()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveCanonicalInvite('  invitation-secret  ');

    expect(result).toEqual({
      termsTitle: '筑大团用户服务协议',
      termsBody: '服务协议正文',
      privacyTitle: '筑大团隐私政策',
      privacyBody: '隐私政策正文',
      termsHash: TERMS_HASH,
      target: 'console',
      governanceLevel: 'administrator',
      effectiveAt: '2026-08-28T00:00:00.000Z',
      expiresAt: '2026-09-28T00:00:00.000Z',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://127.0.0.1:3001/api/v1/identity/invitations/resolve');
    expect(String(url)).not.toContain('invitation-secret');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' });
    expect(JSON.parse(String(init?.body))).toEqual({ invite: 'invitation-secret' });
    expectCanonicalHeaders(init?.headers);
  });

  it('keeps a storefront invitation distinct from an operator invitation', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ ...invitation(), target_client: 'storefront', governance_level: null }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveCanonicalInvite('storefront-invitation')).resolves.toMatchObject({ target: 'storefront' });
  });

  it('preserves the authoritative senior administrator level from invitation resolution', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ ...invitation(), governance_level: 'senior_administrator' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveCanonicalInvite('senior-invitation')).resolves.toMatchObject({
      target: 'console',
      governanceLevel: 'senior_administrator',
    });
  });

  it('creates a registration-only challenge with stable device metadata', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          id: 'challenge:registration-one',
          purpose: 'registration',
          expires_at: '2026-08-28T01:10:00.000Z',
        },
        202
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createCanonicalRegistrationChallenge('  13800138000  ', '  invitation-secret  ');

    expect(result).toEqual({
      challengeId: 'challenge:registration-one',
      purpose: 'registration',
      expiresAt: '2026-08-28T01:10:00.000Z',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://127.0.0.1:3001/api/v1/identity/challenges');
    expect(JSON.parse(String(init?.body))).toEqual({ destination: '13800138000', invite: 'invitation-secret', purpose: 'registration' });
    expectCanonicalHeaders(init?.headers);
  });

  it('creates a storefront member with exact terms evidence and preserves password whitespace', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(membership(), 201));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createCanonicalMember({
      subject: '  +8613800138000  ',
      password: '  SecurePassword1!  ',
      displayName: '  Ethan  ',
      inviteCode: '  invitation-secret  ',
      challengeId: '  challenge:registration-one  ',
      code: '  483921  ',
      termsAccepted: true,
      termsHash: TERMS_HASH,
    });

    expect(result).toEqual({
      membership: 'membership:storefront-one',
      member: 'member:one',
      organization: 'enterprise:one',
      target: 'storefront',
      status: 'active',
      accessVersion: 1,
      employeeNo: null,
      joinedAt: '2026-08-28T01:00:00.000Z',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://127.0.0.1:3001/api/v1/identity/members');
    expect(JSON.parse(String(init?.body))).toEqual({
      subject: '+8613800138000',
      password: '  SecurePassword1!  ',
      displayName: 'Ethan',
      invite: 'invitation-secret',
      challenge: 'challenge:registration-one',
      code: '483921',
      termsAccepted: true,
      termsHash: TERMS_HASH,
    });
    expectCanonicalHeaders(init?.headers);
  });

<<<<<<< HEAD
=======
  it('uses the registration OTP to establish and exchange the new storefront session immediately', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === '/api/v1/identity/members') {
        const authorization = JSON.parse(String(init?.body)).authorization;
        return jsonResponse({
          ...membership(),
          authentication: {
            session: 'session:registration-one',
            csrf: 'csrf-token-at-least-sixteen-characters',
            expiresIn: 43_200,
            membership: 'membership:storefront-one',
            target: 'storefront',
            callback: { ticket: 't'.repeat(64), state: authorization.state },
          },
        }, 201);
      }
      return jsonResponse({
        returnTarget: {
          url: 'http://127.0.0.1:3000/',
          proof: 'signed-return-target-proof',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        expiresIn: 43_200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createCanonicalMember({
      subject: '13800138000',
      password: 'Generated!Password2',
      displayName: 'L6消费者8000',
      inviteCode: 'invitation-secret',
      challengeId: 'challenge:registration-one',
      code: '483921',
      termsAccepted: true,
      termsHash: TERMS_HASH,
      directLogin: true,
    });

    expect(result).toMatchObject({
      membership: 'membership:storefront-one',
      target: 'storefront',
      redirectUrl: 'http://127.0.0.1:3000/',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      subject: '+8613800138000',
      challenge: 'challenge:registration-one',
      code: '483921',
      authorization: { state: expect.any(String), nonce: expect.any(String), challenge: expect.any(String) },
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('http://127.0.0.1:3001/api/v1/identity/tickets/exchange');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ credentials: 'include' });
  });

  it('defers L6 phone verification to checkout while creating a password account', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(membership(), 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createCanonicalMember({
      subject: '13800138000',
      password: 'Generated!Password2',
      displayName: 'L6消费者8000',
      applicationSlug: 'zdt-l1-verify',
      deferPhoneVerification: true,
      termsAccepted: true,
      termsHash: TERMS_HASH,
    })).resolves.toMatchObject({ target: 'storefront' });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      subject: '+8613800138000',
      application: 'zdt-l1-verify',
      phoneVerification: 'checkout',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty('challenge');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty('code');
  });

>>>>>>> 2881cecd (feat(storefront): defer L6 phone verification to checkout)
  it('normalizes a PostgreSQL bigint access version in the registration receipt', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ ...membership(), access_version: '7' }, 201));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createCanonicalMember({
      subject: '+8613800138000',
      password: 'SecurePassword1!',
      displayName: 'Ethan',
      inviteCode: 'invitation-secret',
      challengeId: 'challenge:registration-one',
      code: '483921',
      termsAccepted: true,
      termsHash: TERMS_HASH,
    });

    expect(result.accessVersion).toBe(7);
  });

  it('fails closed before the network when current terms were not accepted', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createCanonicalMember({
        subject: '13800138000',
        password: 'SecurePassword1!',
        displayName: 'Ethan',
        inviteCode: 'invitation-secret',
        challengeId: 'challenge:registration-one',
        code: '483921',
        termsAccepted: false,
        termsHash: TERMS_HASH,
      })
    ).rejects.toThrow('请先阅读并同意当前注册条款与隐私政策');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps authoritative registration errors instead of exposing backend codes as success', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ code: 'INVITE_INVALID' }, 400));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveCanonicalInvite('expired-invite')).rejects.toThrow('邀请码无效、已过期或已被使用');
  });

  it('rejects a non-mobile registration subject before the network', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(createCanonicalRegistrationChallenge('not-a-mobile', 'invitation-secret')).rejects.toThrow('请输入有效的手机号');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an existing mobile subject to a safe login recovery message', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ code: 'IDENTITY_SUBJECT_EXISTS' }, 409));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createCanonicalMember({
        subject: '13800138000',
        password: 'SecurePassword1!',
        displayName: 'Ethan',
        inviteCode: 'invitation-secret',
        challengeId: 'challenge:registration-one',
        code: '483921',
        termsAccepted: true,
        termsHash: TERMS_HASH,
      })
    ).rejects.toThrow('该手机号已注册，请直接登录或找回密码');
  });
});

function expectCanonicalHeaders(headers: HeadersInit | undefined): void {
  expect(headers).toMatchObject({
    'content-type': 'application/json',
    'x-client-version': '0.0.0',
    'x-contract-version': expect.any(String),
    'x-device-id': expect.any(String),
    'x-request-id': expect.any(String),
    'idempotency-key': expect.any(String),
  });
}

function invitation(): Readonly<Record<string, unknown>> {
  return {
    terms_title: '筑大团用户服务协议',
    terms_body: '服务协议正文',
    privacy_title: '筑大团隐私政策',
    privacy_body: '隐私政策正文',
    terms_hash: TERMS_HASH,
    target_client: 'operator',
    governance_level: 'administrator',
    effective_at: '2026-08-28T00:00:00.000Z',
    expires_at: '2026-09-28T00:00:00.000Z',
  };
}

function membership(): Readonly<Record<string, unknown>> {
  return {
    id: 'membership:storefront-one',
    member_id: 'member:one',
    organization_id: 'enterprise:one',
    client: 'storefront',
    employee_no: null,
    status: 'active',
    access_version: 1,
    joined_at: '2026-08-28T01:00:00.000Z',
    left_at: null,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
