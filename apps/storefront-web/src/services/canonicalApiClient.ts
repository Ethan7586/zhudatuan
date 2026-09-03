import { createFetchCommerce, createRequestContext } from '@shop/sdk';
import type { CommerceClient, RequestContext, RequestScope } from '@shop/sdk';
import { ProductionApiError, productionError } from './productionApi.error';

export const CANONICAL_API_ORIGIN = 'https://api.zhudatuan.com';
const LOCAL_API_ORIGINS = new Set(['http://127.0.0.1:3001', 'http://localhost:3001']);

export interface CanonicalSessionContext {
  readonly actor: string;
  readonly session: string;
  readonly membership: string;
  readonly scope: RequestScope;
  readonly scopes: readonly RequestScope[];
  readonly accessVersion: number;
  readonly csrf?: string;
}

interface ContextOptions {
  readonly write?: boolean;
  readonly idempotencyKey?: string;
  readonly expectedVersion?: number;
  readonly includeScope?: boolean;
}

let activeSession: CanonicalSessionContext | null = null;
let cachedClient: Readonly<{ origin: string; value: CommerceClient }> | null = null;

export function resolveProductionApiOrigin(candidate: string | undefined, environment: string | undefined): string {
  const fallback = environment === 'production' ? CANONICAL_API_ORIGIN : 'http://127.0.0.1:3001';
  const parsed = new URL(candidate?.trim() || fallback);
  const approved = parsed.origin === CANONICAL_API_ORIGIN
    || (environment !== 'production' && LOCAL_API_ORIGINS.has(parsed.origin));
  if (!approved || parsed.username || parsed.password || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) {
    throw new ProductionApiError('平台 API 地址不在允许清单', 0, 'API_ORIGIN_DENIED');
  }
  return parsed.origin;
}

export function canonicalClient(): CommerceClient {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_ORIGIN;
  const origin = resolveProductionApiOrigin(configured, process.env.NODE_ENV);
  if (cachedClient?.origin !== origin) cachedClient = Object.freeze({ origin, value: createFetchCommerce(origin) });
  return cachedClient.value;
}

export function anonymousContext(): RequestContext {
  return createRequestContext(clientVersion());
}

export function sessionContext(options: ContextOptions = {}): RequestContext {
  if (!activeSession) throw new ProductionApiError('登录会话尚未建立', 401, 'AUTHENTICATION_REQUIRED');
  if (options.write && !activeSession.csrf) {
    throw new ProductionApiError('安全会话缺少 CSRF 凭据，请重新登录', 403, 'CSRF_TOKEN_MISSING');
  }
  if (options.write && !options.idempotencyKey) {
    throw new ProductionApiError('写入请求缺少幂等键', 0, 'IDEMPOTENCY_KEY_REQUIRED');
  }
  return createRequestContext(clientVersion(), {
    ...(options.includeScope === false ? {} : { scope: activeSession.scope }),
    accessVersion: activeSession.accessVersion,
    ...(options.write ? { csrfToken: activeSession.csrf } : {}),
    ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
  });
}

export function rememberCanonicalSession(session: CanonicalSessionContext): void {
  activeSession = Object.freeze({ ...session, scopes: Object.freeze([...session.scopes]) });
}

export function clearCanonicalSession(): void {
  activeSession = null;
}

export function currentCanonicalSession(): CanonicalSessionContext {
  if (!activeSession) throw new ProductionApiError('登录会话尚未建立', 401, 'AUTHENTICATION_REQUIRED');
  return activeSession;
}

export async function canonicalCall<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (cause) {
    const error = productionError(cause);
    if (error.status === 401 || error.code === 'AUTHENTICATION_REQUIRED') clearCanonicalSession();
    throw error;
  }
}

function clientVersion(): string {
  const value = process.env.NEXT_PUBLIC_CLIENT_VERSION?.trim() || '0.0.0';
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(value)) {
    throw new ProductionApiError('商城客户端版本无效', 0, 'CLIENT_VERSION_INVALID');
  }
  return value;
}
