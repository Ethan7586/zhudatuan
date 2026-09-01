import type { ResourceCondition } from '@shop/design';
import { ApiError } from '@shop/sdk';

export interface QueryStateInput {
  readonly pending: boolean;
  readonly fetching: boolean;
  readonly error: Error | null;
  readonly hasData: boolean;
  readonly empty: boolean;
}

export function queryCondition(input: QueryStateInput): ResourceCondition {
  if (input.pending) return 'loading';
  if (input.error !== null) {
    const condition = errorCondition(input.error);
    if (input.fetching) return 'retry';
    if (input.hasData && (condition === 'offline' || condition === 'failure')) return 'stale';
    return condition;
  }
  if (!input.hasData || input.empty) return 'empty';
  if (input.fetching) return 'refreshing';
  return 'ready';
}

export function safeQueryError(error: Error | null): string | undefined {
  if (error === null) return undefined;
  const api = apiError(error);
  if (api !== null) return apiErrorMessage(api);
  return online() ? '当前请求暂时无法完成，请稍后重试。' : '网络连接已断开，请检查网络后重试。';
}

export function queryErrorCode(error: Error | null, code: string): boolean {
  return error !== null && apiError(error)?.code === code;
}

function errorCondition(error: Error): ResourceCondition {
  if (!online()) return 'offline';
  const api = apiError(error);
  if (api === null) return 'failure';
  if (api.status === 401 || api.status === 403) return 'denied';
  if (api.status === 404) return 'notfound';
  if (api.status === 409 || api.status === 412) return 'conflict';
  if (api.status === 429) return 'ratelimited';
  return 'failure';
}

function apiError(error: Error): Pick<ApiError, 'code' | 'requestId' | 'status'> | null {
  if (error instanceof ApiError) return error;
  const value = error as Error & Partial<Pick<ApiError, 'code' | 'requestId' | 'status'>>;
  return value.name === 'ApiError' && typeof value.code === 'string' && typeof value.requestId === 'string' && typeof value.status === 'number' ? (value as Pick<ApiError, 'code' | 'requestId' | 'status'>) : null;
}

function apiErrorMessage(error: Pick<ApiError, 'code' | 'status'>): string {
  switch (error.code) {
    case 'STEPUP_REQUIRED':
    case 'ACTION_PROOF_REQUIRED':
      return '为保护敏感数据，请先完成二次验证后重试。';
    case 'STEPUP_DESTINATION_MISSING':
      return '当前账号未绑定手机号，请先在员工商城安全中心完成绑定。';
    case 'ACTION_PROOF_INVALID':
    case 'ACTION_PROOF_REPLAYED':
      return '本次身份确认已失效，请重新完成二次验证。';
    case 'AUTHENTICATION_REQUIRED':
    case 'CREDENTIAL_INVALID':
    case 'SESSION_EXPIRED':
      return '登录状态已失效，请重新登录。';
    case 'AUTHORIZATION_DENIED':
    case 'CAPABILITY_DENIED':
    case 'PERMISSION_DENIED':
    case 'SCOPE_DENIED':
      return '当前账号没有执行此操作的权限，请联系管理员。';
    case 'MAKER_CHECKER_SEPARATION_REQUIRED':
      return '该操作需要由另一位有权限的成员复核。';
    case 'OWNER_TRANSFER_REQUIRED':
      return '请先完成所有者移交，再执行此操作。';
    case 'RATE_LIMITED':
      return '操作过于频繁，请稍后再试。';
    case 'VERSION_CONFLICT':
    case 'IDEMPOTENCY_KEY_REUSED':
    case 'IDEMPOTENCY_REPLAY_FORBIDDEN':
      return '数据已发生变化，请刷新后重新操作。';
    case 'VALIDATION_FAILED':
    case 'REQUEST_JSON_INVALID':
      return '提交内容不完整或格式不正确，请检查后重试。';
    case 'CSRF_TOKEN_INVALID':
      return '页面安全凭证已失效，请刷新页面后重试。';
    case 'DEADLINE_EXCEEDED':
      return '服务响应超时，请稍后重试。';
    case 'NOT_FOUND':
      return '请求的数据不存在或已被移除。';
    default:
      return statusMessage(error.status);
  }
}

function statusMessage(status: number): string {
  if (status === 401) return '登录状态已失效，请重新登录。';
  if (status === 403) return '当前账号没有访问此内容的权限，请联系管理员。';
  if (status === 404) return '请求的数据不存在或已被移除。';
  if (status === 409 || status === 412) return '数据已发生变化，请刷新后重新操作。';
  if (status === 429) return '操作过于频繁，请稍后再试。';
  if (status >= 500) return '服务暂时不可用，请稍后重试。';
  return '当前请求暂时无法完成，请检查后重试。';
}

function online(): boolean {
  return typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' || navigator.onLine;
}
