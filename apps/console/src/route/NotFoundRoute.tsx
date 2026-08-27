import { ResourcePanel } from '@shop/design';
import { Link } from 'react-router';

export function Component() {
  return (
    <ResourcePanel title="页面不存在" description="该地址不属于当前 Console 路由清单。" condition="notfound" error="ROUTE_NOT_FOUND"
      actions={<Link to="/">返回经营驾驶舱</Link>}>
      <span />
    </ResourcePanel>
  );
}
