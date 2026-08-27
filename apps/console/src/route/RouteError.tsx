import { ResourcePanel } from '@shop/design';
import { isRouteErrorResponse, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
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
