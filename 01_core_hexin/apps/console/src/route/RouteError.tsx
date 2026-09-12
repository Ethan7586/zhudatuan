import { AccessDenied, ResourcePanel } from '@shop/design';
import { ApiError } from '@shop/sdk';
import { useEffect, useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { appConfig } from '../shared/config/AppConfig';
import { isDynamicImportFailure, recoverFromDynamicImportFailure } from '../shared/recovery/DynamicImportRecovery';

export function RouteError() {
  const error = useRouteError();
  const dynamicImportFailure = isDynamicImportFailure(error);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  useEffect(() => {
    if (!dynamicImportFailure) return;
    setRecoveryBlocked(!recoverFromDynamicImportFailure(error));
  }, [dynamicImportFailure, error]);
  if (dynamicImportFailure && !recoveryBlocked) {
    return <main className="statemain" aria-label="页面更新状态"><p role="status">检测到新版本，正在恢复页面…</p></main>;
  }
  const status = routeErrorStatus(error);
  const unauthenticated = status === 401;
  const denied = status === 403;
  const missing = status === 404;
  if (unauthenticated || denied) {
    return (
      <main className="routeerror">
        <AccessDenied
          kind={unauthenticated ? 'unauthenticated' : 'forbidden'}
          {...(denied ? { resourceLabel: '当前数据范围' } : {})}
          actions={{
            onReturnToWorkspace: () => window.location.assign(new URL(import.meta.env.BASE_URL, window.location.origin).toString()),
            onRelogin: () => window.location.assign(appConfig.identityEntryUrl),
          }}
        />
      </main>
    );
  }
  const condition = missing ? 'notfound' : 'failure';
  const message = missing
    ? '该地址不存在或已被移除。'
    : dynamicImportFailure
      ? error instanceof Error ? error.message : '页面资源更新失败，请手动刷新后重试。'
      : '页面读取失败，请稍后重试。';
  return (
    <main className="routeerror">
      <ResourcePanel title={missing ? '页面不存在' : '控制台不可用'} condition={condition} error={message}>
        <span />
      </ResourcePanel>
    </main>
  );
}

export function routeErrorStatus(error: unknown): number {
  if (isRouteErrorResponse(error)) return error.status;
  if (error instanceof ApiError) return error.status;
  return 500;
}
