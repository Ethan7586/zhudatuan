import { Button, ResourcePanel } from '@shop/design';
import { useEffect } from 'react';
import { useLocation, useNavigate, useRouteError } from 'react-router';
import { NAVIGATION_CATALOG_HASH } from '../generated/NavigationBinding';
import { ROOT_PATH } from '../generated/RouteBinding';

import { routeFailureDetail } from './RouteFailure';

export function RouteError() {
  return <RouteFailure isolated={false} />;
}

export function FeatureRouteError() {
  return <RouteFailure isolated />;
}

function RouteFailure({ isolated }: Readonly<{ isolated: boolean }>) {
  const error = useRouteError();
  const location = useLocation();
  const navigate = useNavigate();
  const detail = routeFailureDetail(error);
  const catalogMismatch = detail.code === 'NAVIGATION_CATALOG_MISMATCH';

  useEffect(() => {
    if (!catalogMismatch) return;
    const key = 'console-navigation-refresh';
    if (window.sessionStorage.getItem(key) === NAVIGATION_CATALOG_HASH) return;
    window.sessionStorage.setItem(key, NAVIGATION_CATALOG_HASH);
    window.location.reload();
  }, [catalogMismatch]);

  const returnToWorkspace = () => void navigate(ROOT_PATH, { replace: true });
  const retry = () => void navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true });
  const actions = (
    <>
      <Button onPress={returnToWorkspace}>返回可用工作台</Button>
      {detail.retryable ? (
        <Button tone="primary" onPress={retry}>
          重新加载
        </Button>
      ) : null}
    </>
  );
  const panel = (
    <ResourcePanel
      title={detail.title}
      {...(isolated ? { description: '仅当前功能区域受到影响，导航和其他页面仍可使用。' } : {})}
      condition={detail.condition}
      error={detail.message}
      actions={actions}
      {...(detail.retryable ? { retry } : {})}
    >
      <span />
    </ResourcePanel>
  );
  return isolated ? <div className="routeerror">{panel}</div> : <main className="routeerror">{panel}</main>;
}
