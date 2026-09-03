import { CONTRACT_VERSION } from '@shop/contract/version';
import { transportInteger } from '@shop/contract/client';
import { z } from 'zod';
import { beginCanonicalAuthorization, exchangeCanonicalStorefrontSession } from './canonicalIdentity';

const CANONICAL_API_ORIGIN = 'https://api.hbbtzn.com';
const LEGACY_API_ORIGIN = 'https://api.zhudatuan.com';
const DEVICE_KEY = 'zhudatuan:identity:device:v1';

const InvitationSchema = z.strictObject({
  terms_title: z.string().min(1),
  terms_body: z.string().min(1),
  privacy_title: z.string().min(1),
  privacy_body: z.string().min(1),
  terms_hash: z.string().regex(/^[a-f0-9]{64}$/i),
  organization_id: z.string().min(1),
  organization_name: z.string().min(1),
  target_client: z.enum(['storefront', 'operator']),
  governance_level: z.enum(['administrator', 'senior_administrator']).nullable().optional(),
  effective_at: z.iso.datetime(),
  expires_at: z.iso.datetime(),
});

const ChallengeSchema = z.strictObject({
  id: z.string().min(1),
  purpose: z.literal('registration'),
  expires_at: z.iso.datetime(),
});

const RegistrationAuthenticationSchema = z.strictObject({
  session: z.string().min(1),
  csrf: z.string().min(16),
  expiresIn: z.number().int().positive(),
  membership: z.string().min(1),
  target: z.literal('storefront'),
  callback: z.strictObject({
    ticket: z.string().min(64).max(128),
    state: z.string().min(32).max(128),
  }),
});

const MembershipSchema = z.strictObject({
  id: z.string().min(1),
  member_id: z.string().min(1),
  organization_id: z.string().min(1),
  client: z.literal('storefront'),
  employee_no: z.string().nullable(),
  status: z.literal('active'),
  access_version: transportInteger.pipe(z.number().positive()),
  joined_at: z.iso.datetime(),
  left_at: z.iso.datetime().nullable(),
  authentication: RegistrationAuthenticationSchema.optional(),
});

export interface CanonicalInvitation {
  readonly termsTitle: string;
  readonly termsBody: string;
  readonly privacyTitle: string;
  readonly privacyBody: string;
  readonly termsHash: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly target: 'storefront' | 'console';
  readonly governanceLevel?: 'administrator' | 'senior_administrator';
  readonly effectiveAt: string;
  readonly expiresAt: string;
}

export interface CanonicalRegistrationChallenge {
  readonly challengeId: string;
  readonly purpose: 'registration';
  readonly expiresAt: string;
}

export interface CanonicalMemberRegistrationInput {
  readonly subject: string;
  readonly password: string;
  readonly displayName: string;
<<<<<<< HEAD
  readonly inviteCode: string;
  readonly challengeId: string;
  readonly code: string;
=======
  readonly inviteCode?: string;
  readonly applicationSlug?: string;
  readonly challengeId?: string;
  readonly code?: string;
  readonly deferPhoneVerification?: boolean;
>>>>>>> 2881cecd (feat(storefront): defer L6 phone verification to checkout)
  readonly termsAccepted: boolean;
  readonly termsHash: string;
  readonly directLogin?: boolean;
  readonly wechatToken?: string;
}

export interface CanonicalRegisteredMember {
  readonly membership: string;
  readonly member: string;
  readonly organization: string;
  readonly target: 'storefront';
  readonly status: 'active';
  readonly accessVersion: number;
  readonly employeeNo: string | null;
  readonly joinedAt: string;
  readonly redirectUrl?: string;
}

export async function resolveCanonicalInvite(inviteCode: string, signal?: AbortSignal): Promise<CanonicalInvitation> {
  const invite = requiredText(inviteCode, '请输入有效的邀请码');
  const output = InvitationSchema.parse(await identityRequest('/api/v1/identity/invitations/resolve', { invite }, signal));
  return Object.freeze({
    termsTitle: output.terms_title,
    termsBody: output.terms_body,
    privacyTitle: output.privacy_title,
    privacyBody: output.privacy_body,
    termsHash: output.terms_hash,
    organizationId: output.organization_id,
    organizationName: output.organization_name,
    target: output.target_client === 'operator' ? 'console' : 'storefront',
    ...(output.governance_level == null ? {} : { governanceLevel: output.governance_level }),
    effectiveAt: output.effective_at,
    expiresAt: output.expires_at,
  });
}

export async function createCanonicalRegistrationChallenge(destination: string, inviteCode: string, signal?: AbortSignal): Promise<CanonicalRegistrationChallenge> {
  const output = ChallengeSchema.parse(
    await identityRequest(
      '/api/v1/identity/challenges',
      {
        destination: requiredMobile(destination),
        invite: requiredText(inviteCode, '请输入有效的邀请码'),
        purpose: 'registration',
      },
      signal
    )
  );
  return Object.freeze({ challengeId: output.id, purpose: output.purpose, expiresAt: output.expires_at });
}

export async function createCanonicalMember(input: CanonicalMemberRegistrationInput, signal?: AbortSignal): Promise<CanonicalRegisteredMember> {
  if (input.termsAccepted !== true) throw new Error('请先阅读并同意当前注册条款与隐私政策');
<<<<<<< HEAD
=======
  const authorization = input.directLogin === true ? await beginCanonicalAuthorization() : undefined;
  const verification = input.deferPhoneVerification === true
    ? { phoneVerification: 'checkout' }
    : {
        challenge: requiredText(input.challengeId, '请先获取验证码'),
        code: requiredText(input.code, '请输入验证码'),
      };
>>>>>>> 2881cecd (feat(storefront): defer L6 phone verification to checkout)
  const output = MembershipSchema.parse(
    await identityRequest(
      '/api/v1/identity/members',
      {
        subject: requiredMobile(input.subject),
        password: requiredPassword(input.password),
        displayName: requiredText(input.displayName, '请输入姓名'),
<<<<<<< HEAD
        invite: requiredText(input.inviteCode, '请输入有效的邀请码'),
        challenge: requiredText(input.challengeId, '请先获取验证码'),
        code: requiredText(input.code, '请输入验证码'),
=======
        ...memberRegistrationReference(input),
        ...verification,
>>>>>>> 2881cecd (feat(storefront): defer L6 phone verification to checkout)
        termsAccepted: true,
        termsHash: requiredText(input.termsHash, '注册条款版本无效'),
        ...(authorization === undefined ? {} : { authorization: authorization.request }),
        ...(input.wechatToken === undefined ? {} : { wechatToken: requiredText(input.wechatToken, '微信授权无效') }),
      },
      signal,
      { credentials: authorization === undefined ? 'omit' : 'include' },
    )
  );
  let redirectUrl: string | undefined;
  if (authorization !== undefined) {
    if (!output.authentication || output.authentication.membership !== output.id) {
      throw new Error('消费者登录会话未能建立，请重新获取验证码');
    }
    redirectUrl = await exchangeCanonicalStorefrontSession(output.authentication.callback, authorization.secret, signal);
  }
  return Object.freeze({
    membership: output.id,
    member: output.member_id,
    organization: output.organization_id,
    target: output.client,
    status: output.status,
    accessVersion: output.access_version,
    employeeNo: output.employee_no,
    joinedAt: output.joined_at,
    ...(redirectUrl === undefined ? {} : { redirectUrl }),
  });
}

async function identityRequest(
  path: string,
  body: Readonly<Record<string, unknown>>,
  signal?: AbortSignal,
  options: Readonly<{ credentials?: RequestCredentials }> = {},
): Promise<unknown> {
  const response = await fetch(new URL(path, apiOrigin()), {
    method: 'POST',
    // Public registration never consumes an existing authenticated session.
    // Omitting cookies prevents a stale API-host session from influencing the
    // anonymous invitation, OTP, or member-creation transaction.
    credentials: options.credentials ?? 'omit',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
      'x-client-version': clientVersion(),
      'x-contract-version': CONTRACT_VERSION,
      'x-device-id': deviceId(),
      'x-request-id': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(registrationError(payload, response.status));
  return payload;
}

function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim() || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : CANONICAL_API_ORIGIN);
  const parsed = new URL(configured);
  const local = import.meta.env.DEV && parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if ((!local && parsed.origin !== CANONICAL_API_ORIGIN && parsed.origin !== LEGACY_API_ORIGIN)
    || parsed.username || parsed.password || parsed.hash) {
    throw new Error('统一身份 API 不在允许清单');
  }
  return parsed.origin;
}

function clientVersion(): string {
  const value = import.meta.env.VITE_CLIENT_VERSION?.trim() || (import.meta.env.DEV ? '0.0.0' : '');
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(value)) throw new Error('身份中心客户端版本无效');
  return value;
}

function deviceId(): string {
  const existing = window.sessionStorage.getItem(DEVICE_KEY);
  if (existing && /^[A-Za-z0-9_-]{32,128}$/.test(existing)) return existing;
  const value = randomToken(32);
  window.sessionStorage.setItem(DEVICE_KEY, value);
  return value;
}

function randomToken(bytes: number): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64url(value);
}

function base64url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function requiredText(value: string, message: string): string {
  const cleaned = value.trim();
  if (cleaned.length === 0 || cleaned.length > 255) throw new Error(message);
  return cleaned;
}

function requiredPassword(value: string): string {
  if (value.length === 0 || value.length > 128) throw new Error('请输入有效密码');
  return value;
}

function requiredMobile(value: string): string {
  const cleaned = value.trim();
  const mainlandChina = /^1[3-9]\d{9}$/.test(cleaned);
  const international = /^\+[1-9]\d{7,14}$/.test(cleaned);
  if (!mainlandChina && !international) throw new Error('请输入有效的手机号');
  return cleaned;
}

function registrationError(value: unknown, status: number): string {
  const code = value !== null && typeof value === 'object' && !Array.isArray(value) && typeof Reflect.get(value, 'code') === 'string' ? String(Reflect.get(value, 'code')) : `HTTP_${status}`;
  return (
    {
      INVITE_INVALID: '邀请码无效、已过期或已被使用',
      RESOURCE_NOT_FOUND: '邀请码无效、已过期或已被使用',
      CHALLENGE_INVALID: '验证码不正确、已过期或已经使用',
      RATE_LIMITED: '验证码请求过多，请稍后再试',
      RISK_REVIEW_REQUIRED: '本次注册需要人工安全复核',
      RISK_DENIED: '本次注册未通过安全检查',
      IDENTITY_SUBJECT_EXISTS: '该手机号已注册，请直接登录或找回密码',
      PASSWORD_POLICY_REJECTED: '密码须为 12–128 位，并同时包含大小写字母、数字和符号',
      TERMS_ACCEPTANCE_REQUIRED: '注册条款已更新，请重新阅读并同意',
    }[code] ?? `统一身份服务暂时无法完成注册（${code}）`
  );
}
