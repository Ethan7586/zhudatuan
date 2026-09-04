import { ResourcePanel } from '@shop/design';
import { Link } from 'react-router';
import { ROOT_PATH } from '../generated/RouteBinding';

export function Component() {
  return (
    <ResourcePanel title="页面不存在" description="该地址不属于当前管理控制台页面清单。" condition="notfound" error="页面地址不受支持" actions={<Link to={ROOT_PATH}>返回经营驾驶舱</Link>}>
      <span />
    </ResourcePanel>
  );
}
