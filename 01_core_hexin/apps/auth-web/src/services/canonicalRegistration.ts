import { CONTRACT_VERSION } from '@shop/contract/version';
import { transportInteger } from '@shop/contract/client';
import { PASSWORD_POLICY_MESSAGE } from '@shop/contract/password-policy';
import { createSecureId } from '@shop/sdk/context';
import { z } from 'zod';
import { beginCanonicalAuthorization, canonicalStorefrontAuthTarget, exchangeCanonicalStorefrontSession } from './canonicalIdentity';

const CANONICAL_API_ORIGIN = 'https://api.zhudatuan.com';
const L1_API_ORIGIN = 'https://api.hbbtzn.com';
const L1_STOREFRONT_API_ORIGIN = 'https://hbbtzn.com';
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

const StorefrontRegistrationSchema = z.strictObject({
  terms_title: z.string().min(1),
  terms_body: z.string().min(1),
  privacy_title: z.string().min(1),
  privacy_body: z.string().min(1),
  terms_hash: z.string().regex(/^[a-f0-9]{64}$/i),
  application_id: z.string().min(1),
  application_slug: z.string().min(1),
  organization_id: z.string().min(1),
  organization_name: z.string().min(1),
  target_client: z.literal('storefront'),
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
  governance_parent_membership_id: z.string().nullable(),
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

export interface CanonicalStorefrontRegistration {
  readonly termsTitle: string;
  readonly termsBody: string;
  readonly privacyTitle: string;
  readonly privacyBody: string;
  readonly termsHash: string;
  readonly applicationId: string;
  readonly applicationSlug: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly target: 'storefront';
}

export interface CanonicalMemberRegistrationInput {
  readonly subject: string;
  readonly password: string;
  readonly displayName: string;
  readonly inviteCode?: string;
  readonly applicationSlug?: string;
  readonly challengeId?: string;
  readonly code?: string;
  readonly deferPhoneVerification?: boolean;
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

export async function resolveCanonicalStorefrontRegistration(
  applicationSlug: string,
  signal?: AbortSignal,
): Promise<CanonicalStorefrontRegistration> {
  const output = StorefrontRegistrationSchema.parse(await identityRequest('/api/v1/identity/storefronts/resolve', {
    application: requiredApplicationSlug(applicationSlug),
  }, signal, { origin: storefrontApiOrigin() }));
  return Object.freeze({
    termsTitle: output.terms_title,
    termsBody: output.terms_body,
    privacyTitle: output.privacy_title,
    privacyBody: output.privacy_body,
    termsHash: output.terms_hash,
    applicationId: output.application_id,
    applicationSlug: output.application_slug,
    organizationId: output.organization_id,
    organizationName: output.organization_name,
    target: 'storefront',
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
  const authorization = input.directLogin === true ? await beginCanonicalAuthorization() : undefined;
  const returnTarget = authorization === undefined ? undefined : canonicalStorefrontAuthTarget(input.applicationSlug);
  const origin = input.directLogin === true ? storefrontApiOrigin() : apiOrigin();
  const verification = input.deferPhoneVerification === true
    ? { phoneVerification: 'checkout' }
    : {
        challenge: requiredText(input.challengeId, '请先获取验证码'),
        code: requiredText(input.code, '请输入验证码'),
      };
  const output = MembershipSchema.parse(
    await identityRequest(
      '/api/v1/identity/members',
      {
        subject: canonicalRegistrationMobile(input.subject),
        password: requiredPassword(input.password),
        displayName: requiredText(input.displayName, '请输入姓名'),
        ...memberRegistrationReference(input),
        ...verification,
        termsAccepted: true,
        termsHash: requiredText(input.termsHash, '注册条款版本无效'),
        ...(authorization === undefined ? {} : { authorization: authorization.request }),
        ...(returnTarget === undefined ? {} : { target: returnTarget }),
        ...(input.wechatToken === undefined ? {} : { wechatToken: requiredText(input.wechatToken, '微信授权无效') }),
      },
      signal,
      { credentials: authorization === undefined ? 'omit' : 'include', origin },
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
  options: Readonly<{ credentials?: RequestCredentials; origin?: string }> = {},
): Promise<unknown> {
  const credentials = options.credentials ?? 'omit';
  const request = () => fetch(new URL(path, options.origin ?? apiOrigin()), {
    method: 'POST',
    // Public registration never consumes an existing authenticated session.
    // Omitting cookies prevents a stale API-host session from influencing the
    // anonymous invitation, OTP, or member-creation transaction.
    credentials,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': createSecureId(),
      'x-client-version': clientVersion(),
      'x-contract-version': CONTRACT_VERSION,
      'x-device-id': deviceId(),
      'x-request-id': createSecureId(),
    },
    body: JSON.stringify(body),
    signal,
  });
  let response = await request();
  let payload = await response.json().catch(() => null);
  if (credentials === 'include' && responseCode(payload, response.status) === 'CSRF_TOKEN_INVALID') {
    response = await request();
    payload = await response.json().catch(() => null);
  }
  if (!response.ok) throw new Error(registrationError(payload, response.status));
  return payload;
}

function apiOrigin(): string {
  return resolveCanonicalRegistrationApiOrigin(
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.DEV,
    typeof window === 'undefined' ? undefined : window.location.hostname,
  );
}

function storefrontApiOrigin(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'accounts.hbbtzn.com') {
    return L1_STOREFRONT_API_ORIGIN;
  }
  return apiOrigin();
}

export function resolveCanonicalRegistrationApiOrigin(
  configured: string | undefined,
  development: boolean,
  hostname?: string,
): string {
  let candidate = configured?.trim() || (development ? 'http://127.0.0.1:3001' : CANONICAL_API_ORIGIN);
  if (hostname?.startsWith('accounts.')) {
    candidate = `https://api.${hostname.slice('accounts.'.length)}`;
  }
  const parsed = new URL(candidate);
  const local = development && parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if ((!local && parsed.origin !== CANONICAL_API_ORIGIN && parsed.origin !== L1_API_ORIGIN)
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

export function canonicalRegistrationMobile(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (/^1[3-9]\d{9}$/.test(compact)) return `+86${compact}`;
  if (/^\+861[3-9]\d{9}$/.test(compact)) return compact;
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) throw new Error('请输入有效的手机号');
  return compact;
}

function memberRegistrationReference(input: CanonicalMemberRegistrationInput): Readonly<{ invite: string } | { application: string }> {
  const hasInvite = typeof input.inviteCode === 'string' && input.inviteCode.trim().length > 0;
  const hasStorefront = typeof input.applicationSlug === 'string' && input.applicationSlug.trim().length > 0;
  if (hasInvite === hasStorefront) throw new Error('请选择唯一的注册入口');
  return hasInvite
    ? { invite: requiredText(input.inviteCode!, '请输入有效的邀请码') }
    : { application: requiredApplicationSlug(input.applicationSlug!) };
}

function requiredApplicationSlug(value: string): string {
  const cleaned = value.trim();
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(cleaned)) throw new Error('商城注册入口无效');
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
  const code = responseCode(value, status);
  return (
    {
      INVITE_INVALID: '邀请码无效、已过期或已被使用',
      RESOURCE_NOT_FOUND: '邀请码无效、已过期或已被使用',
      CHALLENGE_INVALID: '验证码不正确、已过期或已经使用',
      RATE_LIMITED: '验证码请求过多，请稍后再试',
      RISK_REVIEW_REQUIRED: '本次注册需要人工安全复核',
      RISK_DENIED: '本次注册未通过安全检查',
      IDENTITY_SUBJECT_EXISTS: '该手机号已注册，请直接登录或找回密码',
      PASSWORD_POLICY_REJECTED: PASSWORD_POLICY_MESSAGE,
      TERMS_ACCEPTANCE_REQUIRED: '注册条款已更新，请重新阅读并同意',
    }[code] ?? `统一身份服务暂时无法完成注册（${code}）`
  );
}

function responseCode(value: unknown, status: number): string {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof Reflect.get(value, 'code') === 'string'
    ? String(Reflect.get(value, 'code')) : `HTTP_${status}`;
}
