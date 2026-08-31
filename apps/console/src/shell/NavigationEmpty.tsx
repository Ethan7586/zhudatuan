import { ResourcePanel } from '@shop/design';

export function NavigationEmpty() {
  return (
    <main className="routeerror">
      <ResourcePanel title="当前范围暂无可用功能" condition="denied" error="可切换组织范围，或联系管理员申请所需权限与能力。">
        <span />
      </ResourcePanel>
    </main>
  );
}
