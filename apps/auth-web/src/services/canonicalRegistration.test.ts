import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCanonicalMember,
  createCanonicalRegistrationChallenge,
  resolveCanonicalInvite,
} from './canonicalRegistration';

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

  it('creates a registration-only challenge with stable device metadata', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(invitation()))
      .mockResolvedValueOnce(jsonResponse({
        id: 'challenge:registration-one',
        purpose: 'registration',
        expires_at: '2026-08-28T01:10:00.000Z',
      }, 202));
    vi.stubGlobal('fetch', fetchMock);

    await resolveCanonicalInvite('invitation-secret');
    const result = await createCanonicalRegistrationChallenge('  13800138000  ');

    expect(result).toEqual({
      challengeId: 'challenge:registration-one',
      purpose: 'registration',
      expiresAt: '2026-08-28T01:10:00.000Z',
    });
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe('http://127.0.0.1:3001/api/v1/identity/challenges');
    expect(JSON.parse(String(init?.body))).toEqual({ destination: '13800138000', purpose: 'registration', invite: 'invitation-secret' });
    expectCanonicalHeaders(init?.headers);
  });

  it('will not request an SMS challenge until the invitation has been resolved successfully', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ code: 'INVITE_INVALID' }, 400));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveCanonicalInvite('invalid-invitation')).rejects.toThrow('邀请码无效、已过期或已被使用');
    await expect(createCanonicalRegistrationChallenge('13800138000')).rejects.toThrow('请先验证有效的企业邀请码');
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it('fails closed before the network when current terms were not accepted', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(createCanonicalMember({
      subject: '13800138000',
      password: 'SecurePassword1!',
      displayName: 'Ethan',
      inviteCode: 'invitation-secret',
      challengeId: 'challenge:registration-one',
      code: '483921',
      termsAccepted: false,
      termsHash: TERMS_HASH,
    })).rejects.toThrow('请先阅读并同意当前注册条款与隐私政策');
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

    await expect(createCanonicalRegistrationChallenge('not-a-mobile')).rejects.toThrow('请输入有效的手机号');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an existing mobile subject to a safe login recovery message', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ code: 'IDENTITY_SUBJECT_EXISTS' }, 409));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createCanonicalMember({
      subject: '13800138000',
      password: 'SecurePassword1!',
      displayName: 'Ethan',
      inviteCode: 'invitation-secret',
      challengeId: 'challenge:registration-one',
      code: '483921',
      termsAccepted: true,
      termsHash: TERMS_HASH,
    })).rejects.toThrow('该手机号已注册，请直接登录或找回密码');
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
