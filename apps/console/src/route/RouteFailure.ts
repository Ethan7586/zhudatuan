import type { ApiErrorCode } from '@shop/contract';
import type { ResourceCondition } from '@shop/design';
import { failure, presentError } from '@shop/presentation';
import { isRouteErrorResponse } from 'react-router';

const routeApiErrorCodes = Object.freeze([
  'AUTHORIZATION_DENIED',
  'CAPABILITY_DENIED',
  'NAVIGATION_CATALOG_MISMATCH',
  'NAVIGATION_EMPTY',
  'NAVIGATION_SCOPE_DENIED',
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'SCOPE_DENIED',
] as const satisfies readonly ApiErrorCode[]);

export interface RouteFailureDetail {
  readonly code: string;
  readonly title: string;
  readonly message: string;
  readonly condition: ResourceCondition;
  readonly retryable: boolean;
}

export function routeFailureDetail(error: unknown): RouteFailureDetail {
  const status = routeStatus(error);
  const code = routeCode(error);
  const value = isApiErrorCode(code) ? { kind: 'api' as const, code, retryable: status >= 500 } : failure(error);
  const view = presentError(value);
  if (code === 'NAVIGATION_EMPTY') {
    return { code, title: '当前范围暂无可用功能', message: '可切换组织范围，或联系管理员申请所需权限与能力。', condition: 'forbidden', retryable: false };
  }
  if (code === 'NAVIGATION_CATALOG_MISMATCH') {
    return { code, title: '控制台需要更新', message: '导航版本与当前页面不一致，系统将自动刷新；若仍未恢复，请稍后重试。', condition: 'unavailable', retryable: true };
  }
  if (status === 401) return { code, title: '登录状态已失效', message: '请重新登录后继续，尚未提交的页面操作不会执行。', condition: 'forbidden', retryable: false };
  if (status === 403) return { code, title: '当前页面不可用', message: view.message, condition: 'forbidden', retryable: false };
  if (status === 404) return { code, title: '页面不存在', message: '该地址不存在、已被移除，或不属于当前管理范围。', condition: 'notfound', retryable: false };
  return { code, title: view.title, message: view.message, condition: routeCondition(status, code), retryable: view.retryable || status >= 500 };
}

function routeStatus(error: unknown): number {
  if (isRouteErrorResponse(error)) return error.status;
  if (error !== null && typeof error === 'object' && 'status' in error && typeof error.status === 'number') return error.status;
  const value = failure(error);
  if (value.kind === 'transport') return value.code === 'OFFLINE' ? 0 : 503;
  return 500;
}

function routeCode(error: unknown): string {
  if (isRouteErrorResponse(error)) return responseCode(error.data);
  return failure(error).code;
}

function responseCode(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return '';
  return 'code' in data && typeof data.code === 'string' ? data.code : '';
}

function isApiErrorCode(value: string): value is ApiErrorCode {
  return routeApiErrorCodes.some((code) => code === value);
}

function routeCondition(status: number, code: string): ResourceCondition {
  if (code === 'OFFLINE') return 'offline';
  if (status === 409) return 'conflict';
  if (status === 429) return 'ratelimited';
  if (status === 503) return 'unavailable';
  return 'failure';
}
