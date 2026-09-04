import { ResourcePanel } from '@shop/design';
import { ApiError } from '@shop/sdk/error';
import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { NAVIGATION_CATALOG_HASH } from '../generated/NavigationBinding';
import { NavigationEmpty } from '../shell/NavigationEmpty';
import { NavigationError } from '../shell/NavigationError';

export function RouteError() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : error instanceof ApiError ? error.status : 500;
  const data: unknown = isRouteErrorResponse(error) ? (error.data as unknown) : undefined;
  const code = apiErrorCode(error) ?? routeCode(data);
  const catalogMismatch = status === 409 || code === 'NAVIGATION_CATALOG_MISMATCH';
  useEffect(() => {
    if (!catalogMismatch) return;
    const key = 'console-navigation-refresh';
    if (window.sessionStorage.getItem(key) === NAVIGATION_CATALOG_HASH) return;
    window.sessionStorage.setItem(key, NAVIGATION_CATALOG_HASH);
    window.location.reload();
  }, [catalogMismatch]);
  if (status === 403 && code.includes('NAVIGATION_EMPTY')) return <NavigationEmpty />;
  if (catalogMismatch) return <NavigationError kind="catalog" />;
  if (status === 401) return <NavigationError kind="session" />;
  if (status >= 500) return <NavigationError kind="dependency" />;
  const denied = status === 401 || status === 403;
  const missing = status === 404;
  const condition = denied ? 'denied' : missing ? 'notfound' : 'failure';
  const message = denied ? '当前会话未获得该数据范围。' : missing ? '该地址不存在或已被移除。' : '页面读取失败，请稍后重试。';
  return (
    <main className="routeerror">
      <ResourcePanel title={denied ? '访问受限' : missing ? '页面不存在' : '控制台不可用'} condition={condition} error={message}>
        <span />
      </ResourcePanel>
    </main>
  );
}

function apiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

function routeCode(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return '';
  if ('code' in data && typeof data.code === 'string') return data.code;
  return '';
}
