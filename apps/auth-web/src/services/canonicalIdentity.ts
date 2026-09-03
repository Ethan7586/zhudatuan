import { CONTRACT_VERSION } from '@shop/contract/version';
import { z } from 'zod';
import { runtimeConsumerFacadeOrigin } from './consumerFacade';
import type { Membership, PreAuthContext } from '../types';
import { resolveAdminLoginOrigin } from './auth';

const CANONICAL_API_ORIGIN = 'https://api.zhudatuan.com';
const DEVICE_KEY = 'zhudatuan:identity:device:v1';

const MembershipSelectionSchema = z.strictObject({
  principal: z.string().min(1),
  memberships: z.array(z.strictObject({
    id: z.string().min(1),
    client: z.enum(['console', 'storefront', 'store', 'supplier']),
  })),
});

const SessionCreatedSchema = z.strictObject({
  session: z.string().min(1),
  csrf: z.string().min(16),
  expiresIn: z.number().int().positive(),
  membership: z.string().min(1),
  target: z.enum(['console', 'storefront', 'store', 'supplier']),
  callback: z.strictObject({
    ticket: z.string().min(64).max(128),
    state: z.string().min(32).max(128),
  }),
});

const LoginResultSchema = z.union([MembershipSelectionSchema, SessionCreatedSchema]);

const TicketExchangeSchema = z.strictObject({
  returnTarget: z.strictObject({
    url: z.url(),
    proof: z.string().min(16),
    expiresAt: z.iso.datetime(),
  }),
  expiresIn: z.number().int().positive(),
});

const LoginChallengeSchema = z.strictObject({
  id: z.string().min(1),
  purpose: z.literal('login'),
  expires_at: z.iso.datetime(),
});

const PasswordResetChallengeSchema = z.strictObject({
  id: z.string().min(1),
  purpose: z.literal('password_reset'),
  expires_at: z.iso.datetime(),
});

const CurrentStorefrontSessionSchema = z.object({
  target: z.literal('storefront'),
  governance: z.object({ organization: z.string().min(1) }),
});

export type CanonicalConsoleLoginResult =
  | Readonly<{ kind: 'selection'; context: PreAuthContext }>
  | Readonly<{ kind: 'authenticated'; membership: string; redirectUrl: string }>;

export type CanonicalStorefrontLoginResult = Readonly<{
  membership: string;
  redirectUrl: string;
}>;

export type CanonicalStorefrontEntryResult =
  | Readonly<{ kind: 'selection'; context: PreAuthContext }>
  | Readonly<{ kind: 'authenticated'; membership: string; redirectUrl: string }>;

export interface CanonicalAuthorization {
  readonly request: Readonly<{ state: string; nonce: string; challenge: string }>;
  readonly secret: Readonly<{ nonce: string; verifier: string }>;
}

export interface CanonicalSessionCallback {
  readonly ticket: string;
  readonly state: string;
}

export interface CanonicalLoginChallenge {
  readonly challengeId: string;
  readonly expiresAt: string;
}

export interface CanonicalPasswordResetChallenge {
  readonly challengeId: string;
  readonly expiresAt: string;
}

export async function currentCanonicalStorefrontOrganization(signal?: AbortSignal): Promise<string | null> {
  const response = await fetch(new URL('/api/v1/identity/session', apiOrigin()), {
    method: 'GET',
    credentials: 'include',
    redirect: 'error',
    headers: {
      accept: 'application/json',
      'x-client-version': clientVersion(),
      'x-contract-version': CONTRACT_VERSION,
      'x-device-id': deviceId(),
      'x-request-id': crypto.randomUUID(),
    },
    signal,
  });
  if (!response.ok) return null;
  const parsed = CurrentStorefrontSessionSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data.governance.organization : null;
}

type LoginCredential =
  | Readonly<{ provider: 'password'; subject: string; password: string }>
  | Readonly<{ provider: 'phone_otp'; subject: string; challenge: string; code: string }>;

export async function createCanonicalLoginChallenge(phone: string, signal?: AbortSignal): Promise<CanonicalLoginChallenge> {
  const output = LoginChallengeSchema.parse(await identityRequest('/api/v1/identity/challenges', {
    purpose: 'login',
    destination: canonicalMobile(phone),
  }, signal));
  return Object.freeze({ challengeId: output.id, expiresAt: output.expires_at });
}

export async function loginCanonicalConsole(
  subject: string,
  password: string,
  membership?: string,
  signal?: AbortSignal,
): Promise<CanonicalConsoleLoginResult> {
  const authorization = await beginAuthorization();
  const output = LoginResultSchema.parse(await identityRequest('/api/v1/identity/sessions', {
    provider: 'password',
    subject: subject.trim(),
    password,
    target: 'console',
    ...(membership === undefined ? {} : { membership }),
    authorization: authorization.request,
  }, signal));

  if ('memberships' in output) {
    const context: PreAuthContext = {
      identifier: subject.trim(),
      loginMethod: 'password',
      memberships: output.memberships.map(consoleMembership),
    };
    return Object.freeze({
      kind: 'selection',
      context,
    });
  }

  if (output.target !== 'console') throw new Error('登录身份不属于运营后台');
  const exchanged = TicketExchangeSchema.parse(await identityRequest('/api/v1/identity/tickets/exchange', {
    ticket: output.callback.ticket,
    state: output.callback.state,
    nonce: authorization.secret.nonce,
    verifier: authorization.secret.verifier,
  }, signal));
  const redirectUrl = approvedConsoleDestination(exchanged.returnTarget);
  return Object.freeze({ kind: 'authenticated', membership: output.membership, redirectUrl });
}

function consoleMembership(value: z.infer<typeof MembershipSelectionSchema>['memberships'][number]): Membership {
  if (value.client !== 'console') throw new Error('后台登录返回了错误的会员入口');
  return {
    id: value.id,
    target: 'admin',
    status: 'active',
    enterpriseName: '已授权企业',
    storeName: '筑大团运营后台',
    roleName: '运营会员',
    dataScope: '按权限系统授权范围',
    subjectScope: '企业',
    requiresStepUp: false,
  };
}

async function identityRequest(path: string, body: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(new URL(path, apiOrigin()), {
    method: 'POST',
    credentials: 'include',
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
  if (!response.ok) throw new Error(identityError(payload, response.status));
  return payload;
}

async function beginAuthorization(): Promise<Readonly<{
  request: Readonly<{ state: string; nonce: string; challenge: string }>;
  secret: Readonly<{ nonce: string; verifier: string }>;
}>> {
  const state = randomToken(32);
  const nonce = randomToken(32);
  const verifier = randomToken(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return Object.freeze({
    request: Object.freeze({ state, nonce, challenge: base64url(new Uint8Array(digest)) }),
    secret: Object.freeze({ nonce, verifier }),
  });
}

function approvedConsoleDestination(value: z.infer<typeof TicketExchangeSchema>['returnTarget']): string {
  const expiry = Date.parse(value.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error('登录回跳授权已经过期');
  let destination: URL;
  try {
    destination = new URL(value.url);
  } catch {
    throw new Error('登录回跳地址无效');
  }
  const configured = import.meta.env.VITE_ADMIN_ORIGIN || (import.meta.env.DEV ? 'http://127.0.0.1:4173' : undefined);
  const approvedOrigin = resolveAdminLoginOrigin(configured, import.meta.env.DEV);
  if (destination.origin !== approvedOrigin || destination.username || destination.password || destination.hash) {
    throw new Error('登录回跳地址不在后台允许清单');
  }
  return destination.toString();
}

function apiOrigin(): string {
  const facadeOrigin = runtimeConsumerFacadeOrigin();
  const configured = facadeOrigin ?? (import.meta.env.VITE_API_BASE_URL?.trim() || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : CANONICAL_API_ORIGIN));
  const parsed = new URL(configured);
  const local = import.meta.env.DEV && parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  const facade = facadeOrigin !== undefined && parsed.origin === facadeOrigin;
  if ((!local && !facade && parsed.origin !== CANONICAL_API_ORIGIN) || parsed.username || parsed.password || parsed.hash) {
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

function identityError(value: unknown, status: number): string {
  const code = value !== null && typeof value === 'object' && !Array.isArray(value) && typeof Reflect.get(value, 'code') === 'string'
    ? String(Reflect.get(value, 'code'))
    : `HTTP_${status}`;
  return {
    CREDENTIAL_INVALID: '账号或密码不正确',
    MEMBERSHIP_INACTIVE: '该账号没有可用的后台会员身份',
    RATE_LIMITED: '登录尝试过多，请稍后再试',
    RISK_REVIEW_REQUIRED: '本次登录需要人工安全复核',
    AUTHENTICATION_REQUIRED: '登录会话未能建立，请重新登录',
    AUTH_TICKET_EXCHANGE_REJECTED: '一次性登录授权无效或已经使用',
  }[code] ?? `统一身份服务暂时无法完成登录（${code}）`;
}
